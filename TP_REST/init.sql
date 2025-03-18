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