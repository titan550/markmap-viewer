/**
 * History modal for viewing and loading saved snapshots.
 */

import type { SnapshotRecord } from "../storage/db";
import {
  deleteSnapshot,
  isStorageAvailable,
  listSnapshots,
  saveSnapshot,
  togglePin,
  updateTitle,
} from "../storage/db";
import { hashMarkdown } from "../storage/hash";
import { extractTitle } from "../storage/title";

export type HistoryModalDeps = {
  historyModal: HTMLElement;
  closeHistoryBtn: HTMLButtonElement;
  historyList: HTMLElement;
  historyEmpty: HTMLElement;
  historySearch: HTMLInputElement;
  saveSnapshotBtn: HTMLButtonElement;
  openHistoryBtn: HTMLButtonElement;
  openHistoryOverlayBtn: HTMLButtonElement;
  // Save modal elements
  saveModal: HTMLElement;
  saveTitle: HTMLInputElement;
  saveCancelBtn: HTMLButtonElement;
  saveConfirmBtn: HTMLButtonElement;
  getContent: () => string;
  loadContent: (markdown: string) => void;
  getLastManualDigest: () => string | undefined;
  setLastManualDigest: (digest: string) => void;
};

let previousActiveElement: Element | null = null;

/**
 * Format a timestamp as relative time (e.g., "2h ago", "1d ago").
 */
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

/**
 * Format character count (e.g., "1,234 chars").
 */
function formatCharCount(count: number): string {
  return `${count.toLocaleString()} chars`;
}

/**
 * Check if the current content is dirty (differs from last manual save).
 */
async function isDirty(
  getContent: () => string,
  getLastManualDigest: () => string | undefined
): Promise<boolean> {
  const lastDigest = getLastManualDigest();
  if (!lastDigest) return false;

  const content = getContent();
  if (!content.trim()) return false;

  const currentDigest = await hashMarkdown(content);
  return currentDigest !== lastDigest;
}

/**
 * Create a snapshot list item element.
 */
function createSnapshotItem(
  snapshot: SnapshotRecord,
  onPin: () => void,
  onLoad: () => void,
  onDelete: () => void,
  onRename: (newTitle: string) => void
): HTMLElement {
  const item = document.createElement("div");
  item.className = "history-item";
  if (snapshot.isPinned) item.classList.add("pinned");
  item.dataset.id = snapshot.id;

  const info = document.createElement("div");
  info.className = "history-item-info";

  const title = document.createElement("div");
  title.className = "history-item-title";
  title.textContent = snapshot.title;
  title.title = "Double-click to rename";

  function handleTitleDoubleClick(): void {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "history-item-title-input";
    input.value = snapshot.title;

    function commitTitle(): void {
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== snapshot.title) {
        onRename(newTitle);
      } else {
        // Restore original
        title.textContent = snapshot.title;
        title.style.display = "";
      }
      input.remove();
    }

    function cancelTitle(): void {
      title.textContent = snapshot.title;
      title.style.display = "";
      input.remove();
    }

    function handleTitleInputKeydown(e: KeyboardEvent): void {
      if (e.key === "Enter") {
        e.preventDefault();
        commitTitle();
      } else if (e.key === "Escape") {
        cancelTitle();
      }
    }

    input.addEventListener("blur", commitTitle);
    input.addEventListener("keydown", handleTitleInputKeydown);
    title.style.display = "none";
    title.insertAdjacentElement("beforebegin", input);
    input.focus();
    input.select();
  }

  // Double-click to rename
  title.addEventListener("dblclick", handleTitleDoubleClick);

  const meta = document.createElement("div");
  meta.className = "history-item-meta";
  const pinnedLabel = snapshot.isPinned ? "📌 " : "";
  meta.textContent = `${pinnedLabel}${formatCharCount(snapshot.charCount)} · ${formatTimeAgo(
    snapshot.createdAt
  )}`;

  info.appendChild(title);
  info.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "history-item-actions";

  const pinBtn = document.createElement("button");
  pinBtn.type = "button";
  pinBtn.className = "history-pin-btn" + (snapshot.isPinned ? " pinned" : "");
  pinBtn.textContent = snapshot.isPinned ? "Unpin" : "Pin";
  pinBtn.title = snapshot.isPinned ? "Unpin diagram" : "Pin to keep forever";
  pinBtn.onclick = onPin;

  const loadBtn = document.createElement("button");
  loadBtn.type = "button";
  loadBtn.className = "history-load-btn";
  loadBtn.textContent = "Load";
  loadBtn.onclick = onLoad;

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "history-delete-btn";
  deleteBtn.textContent = "Delete";
  deleteBtn.onclick = onDelete;

  actions.appendChild(pinBtn);
  actions.appendChild(loadBtn);
  actions.appendChild(deleteBtn);

  item.appendChild(info);
  item.appendChild(actions);

  return item;
}

/**
 * Initialize the history modal.
 */
export function initHistoryModal(deps: HistoryModalDeps): {
  open: () => Promise<void>;
  close: () => void;
  save: () => Promise<void>;
} {
  const {
    historyModal,
    closeHistoryBtn,
    historyList,
    historyEmpty,
    historySearch,
    saveSnapshotBtn,
    openHistoryBtn,
    openHistoryOverlayBtn,
    saveModal,
    saveTitle,
    saveCancelBtn,
    saveConfirmBtn,
    getContent,
    loadContent,
    getLastManualDigest,
    setLastManualDigest,
  } = deps;

  const storageAvailable = isStorageAvailable();
  let searchQuery = "";

  function disableHistoryUi(): void {
    saveSnapshotBtn.disabled = true;
    saveSnapshotBtn.title = "Storage unavailable";
    openHistoryBtn.disabled = true;
    openHistoryBtn.title = "Storage unavailable";
    openHistoryOverlayBtn.disabled = true;
    openHistoryOverlayBtn.title = "Storage unavailable";
    historySearch.disabled = true;
  }

  if (!storageAvailable) {
    disableHistoryUi();
  }

  async function refreshList(): Promise<void> {
    if (!storageAvailable) return;

    let snapshots = await listSnapshots();

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      snapshots = snapshots.filter((s) => s.title.toLowerCase().includes(query));
    }

    // Sort: pinned first, then by createdAt descending
    snapshots.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.createdAt - a.createdAt;
    });

    historyList.innerHTML = "";

    if (snapshots.length === 0) {
      historyList.classList.add("hidden");
      historyEmpty.classList.remove("hidden");
      return;
    }

    historyList.classList.remove("hidden");
    historyEmpty.classList.add("hidden");

    for (const snapshot of snapshots) {
      const item = createSnapshotItem(
        snapshot,
        () => handlePin(snapshot.id),
        () => handleLoad(snapshot),
        () => handleDelete(snapshot.id),
        (newTitle) => handleRename(snapshot.id, newTitle)
      );
      historyList.appendChild(item);
    }
  }

  async function handlePin(id: string): Promise<void> {
    await togglePin(id);
    await refreshList();
  }

  async function handleRename(id: string, newTitle: string): Promise<void> {
    await updateTitle(id, newTitle);
    await refreshList();
  }

  async function handleLoad(snapshot: SnapshotRecord): Promise<void> {
    // Check if current content is dirty
    const dirty = await isDirty(getContent, getLastManualDigest);
    if (dirty) {
      const confirmed = confirm("You have unsaved changes. Load this diagram anyway?");
      if (!confirmed) return;
    }

    loadContent(snapshot.markdown);
    setLastManualDigest(snapshot.digest);
    close();
  }

  async function handleDelete(id: string): Promise<void> {
    const confirmed = confirm("Delete this diagram?");
    if (!confirmed) return;

    await deleteSnapshot(id);
    await refreshList();
  }

  async function open(): Promise<void> {
    if (!storageAvailable) return;

    previousActiveElement = document.activeElement;
    searchQuery = "";
    historySearch.value = "";
    await refreshList();
    historyModal.classList.remove("hidden");
    historySearch.focus();
  }

  function close(): void {
    historyModal.classList.add("hidden");
    searchQuery = "";
    historySearch.value = "";
    if (previousActiveElement instanceof HTMLElement) {
      previousActiveElement.focus();
    }
  }

  // Save modal functions
  function openSaveModal(): void {
    if (!storageAvailable) return;

    const content = getContent();
    if (!content.trim()) return;

    // Pre-fill with auto-extracted title
    const defaultTitle = extractTitle(content);
    saveTitle.value = defaultTitle;
    saveModal.classList.remove("hidden");
    saveTitle.focus();
    saveTitle.select();
  }

  function closeSaveModal(): void {
    saveModal.classList.add("hidden");
  }

  function resetSaveButton(): void {
    saveSnapshotBtn.classList.remove("saving", "saved", "duplicate");
    saveSnapshotBtn.textContent = "Save";
  }

  function showSaveButtonResult(label: string, className?: "saved" | "duplicate"): void {
    saveSnapshotBtn.classList.remove("saving");
    if (className) {
      saveSnapshotBtn.classList.add(className);
    }
    saveSnapshotBtn.textContent = label;
    window.setTimeout(() => resetSaveButton(), 1500);
  }

  function showSaveButtonFailure(): void {
    saveSnapshotBtn.classList.remove("saving");
    saveSnapshotBtn.textContent = "Failed";
    window.setTimeout(() => resetSaveButton(), 1500);
  }

  async function confirmSave(): Promise<void> {
    const content = getContent();
    if (!content.trim()) {
      closeSaveModal();
      return;
    }

    const title = saveTitle.value.trim();
    closeSaveModal();

    saveSnapshotBtn.classList.add("saving");
    saveSnapshotBtn.textContent = "Saving...";

    const result = await saveSnapshot(content, title).catch(() => null);
    if (!result) {
      showSaveButtonFailure();
      return;
    }

    const { record, isNew } = result;
    setLastManualDigest(record.digest);
    if (isNew) {
      showSaveButtonResult("Saved!", "saved");
    } else {
      showSaveButtonResult("Already saved", "duplicate");
    }
  }

  async function save(): Promise<void> {
    if (!storageAvailable) return;

    const content = getContent();
    if (!content.trim()) {
      return;
    }

    openSaveModal();
  }

  // Event listeners
  closeHistoryBtn.addEventListener("click", close);
  saveSnapshotBtn.addEventListener("click", save);

  // Save modal event listeners
  saveCancelBtn.addEventListener("click", closeSaveModal);
  saveConfirmBtn.addEventListener("click", confirmSave);
  function handleSaveModalClick(e: MouseEvent): void {
    if (e.target === saveModal) closeSaveModal();
  }

  function handleSaveModalKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") closeSaveModal();
    if (e.key === "Enter") {
      e.preventDefault();
      confirmSave();
    }
  }

  saveModal.addEventListener("click", handleSaveModalClick);
  saveModal.addEventListener("keydown", handleSaveModalKeydown);
  openHistoryBtn.addEventListener("click", open);
  openHistoryOverlayBtn.addEventListener("click", open);

  // Search input with debounce
  let searchTimeout: number | undefined;
  function handleSearchInput(): void {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = window.setTimeout(() => {
      searchQuery = historySearch.value;
      refreshList();
    }, 150);
  }
  historySearch.addEventListener("input", handleSearchInput);

  // Close on backdrop click
  function handleHistoryModalClick(e: MouseEvent): void {
    if (e.target === historyModal) {
      close();
    }
  }
  historyModal.addEventListener("click", handleHistoryModalClick);

  // Close on Escape key
  function handleHistoryModalKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      close();
    }
  }
  historyModal.addEventListener("keydown", handleHistoryModalKeydown);

  return { open, close, save };
}
