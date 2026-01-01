# Prism Syntax Highlighting Test

## Python Code
```python
def fibonacci(n):
    """Calculate the nth Fibonacci number."""
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# Test with list comprehension
squares = [x**2 for x in range(10)]
print(f"Fibonacci(10) = {fibonacci(10)}")
```

## TypeScript Code
```typescript
interface User {
  name: string;
  age: number;
  email?: string;
}

class UserManager {
  private users: User[] = [];

  addUser(user: User): void {
    this.users.push(user);
  }

  findByName(name: string): User | undefined {
    return this.users.find(u => u.name === name);
  }
}

const manager = new UserManager();
manager.addUser({ name: "Alice", age: 30 });
```

## JavaScript (using alias)
```js
const fetchData = async (url) => {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching data:', error);
    return null;
  }
};

// Arrow function example
const double = x => x * 2;
```

## SQL Query
```sql
-- Complex SQL query with joins
SELECT
  u.id,
  u.name,
  u.email,
  COUNT(o.id) as order_count,
  SUM(o.total) as total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.status = 'active'
  AND o.created_at > '2024-01-01'
GROUP BY u.id, u.name, u.email
HAVING COUNT(o.id) > 5
ORDER BY total_spent DESC
LIMIT 10;
```

## Bash Script (using alias)
```sh
#!/bin/bash
# Backup script

BACKUP_DIR="/backup/$(date +%Y%m%d)"
SOURCE_DIR="/data"

echo "Starting backup to $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

tar -czf "$BACKUP_DIR/data.tar.gz" "$SOURCE_DIR"

if [ $? -eq 0 ]; then
  echo "Backup completed successfully"
else
  echo "Backup failed" >&2
  exit 1
fi
```

## YAML Configuration
```yml
# Docker Compose configuration
version: '3.8'

services:
  web:
    image: nginx:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./html:/usr/share/nginx/html
    environment:
      - NGINX_HOST=example.com
      - NGINX_PORT=80
    depends_on:
      - api

  api:
    build: ./api
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://user:pass@db:5432/mydb
    networks:
      - backend

networks:
  backend:
    driver: bridge
```

## Rust Code
```rust
// Rust example (not an alias)
use std::collections::HashMap;

#[derive(Debug)]
struct Person {
    name: String,
    age: u32,
}

impl Person {
    fn new(name: &str, age: u32) -> Self {
        Person {
            name: name.to_string(),
            age,
        }
    }

    fn greet(&self) -> String {
        format!("Hello, I'm {} and I'm {} years old", self.name, self.age)
    }
}

fn main() {
    let mut people: HashMap<u32, Person> = HashMap::new();

    people.insert(1, Person::new("Alice", 30));
    people.insert(2, Person::new("Bob", 25));

    for (id, person) in &people {
        println!("ID {}: {}", id, person.greet());
    }
}
```
