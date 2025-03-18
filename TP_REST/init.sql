CREATE TABLE
  products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    about VARCHAR(500),
    price FLOAT
  );

INSERT INTO
  products (name, about, price)
VALUES
  ('My first game', 'This is an awesome game', '60');

CREATE TABLE
  users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(500),
    password VARCHAR(500),
    email VARCHAR(500)
  );

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    userId INTEGER REFERENCES users(id) ON DELETE CASCADE,
    productIds INTEGER[],
    total NUMERIC(10,2) NOT NULL,
    payment BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    userId INTEGER REFERENCES users(id) ON DELETE CASCADE,
    productId INTEGER REFERENCES products(id) ON DELETE CASCADE,
    score INTEGER CHECK (score BETWEEN 1 AND 5) NOT NULL,
    content TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE products ADD COLUMN averageScore NUMERIC(3,2) DEFAULT 0;