const express = require("express");
const postgres = require("postgres");
const z = require("zod");

const bcrypt = require("bcrypt");
const saltRounds = 10; // Niveau de hachage

const app = express();
const port = 8000;
const sql = postgres({ db: "mydb", user: "user", password: "password", port: "5433" });

app.use(express.json());

// Schemas
const ProductSchema = z.object({
    id: z.string(),
    name: z.string(),
    about: z.string(),
    price: z.number().positive(),
});

const CreateProductSchema = ProductSchema.omit({ id: true });

const UserSchema = z.object({
    id: z.string(),
    username: z.string(),
    password: z.string().min(6), // Sécurité minimale
    email: z.string().email()
});

const CreateUserSchema = UserSchema.omit({ id: true });

////////////////////////////////////////////////////////
// Routes produits 

app.get("/", (req, res) => {
    res.send("<p style= \"white-space:pre-line\">/products/:id - Récupère un produit. \n /products/ - Récupère tous les produits. \n /products/ - Crée un nouveau produit grâce au body de la requête HTTP. \n DELETE products/:id - Supprime un produit.</p>");
});

// Route GET /products/:id - Récupérer un produit spécifique
app.get("/products/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const product = await sql`SELECT * FROM products WHERE id = ${id}`;

        if (product.length === 0) {
            return res.status(404).json({ error: "Produit non trouvé" });
        }

        res.json(product[0]);
    } catch (error) {
        res.status(500).json({ error: "Erreur serveur", details: error.message });
    }
});

// Route GET /products - Récupérer tous les produits avec pagination
app.get("/products", async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const products = await sql`SELECT * FROM products LIMIT ${limit} OFFSET ${offset}`;
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: "Erreur serveur", details: error.message });
    }
});

// Route POST /products - Ajouter un produit
app.post("/products", async (req, res) => {
    try {
        const parsedProduct = CreateProductSchema.parse(req.body);
        const { name, about, price } = parsedProduct;

        await sql`INSERT INTO products ( name, about, price) VALUES (${name}, ${about}, ${price})`;

        // Retourner le produit qui a été créé
        res.status(201).json({
            message: "Produit créé avec succès",
            product: { name, about, price }
        });

    } catch (error) {
        res.status(400).json({ error: "Données invalides", details: error.message });
    }
});

// Route DELETE /products/:id - Supprimer un produit
app.delete("/products/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await sql`DELETE FROM products WHERE id = ${id}`;

        if (result.count === 0) {
            return res.status(404).json({ error: "Produit non trouvé" });
        }

        res.json({ message: "Produit supprimé avec succès" });
    } catch (error) {
        res.status(500).json({ error: "Erreur serveur", details: error.message });
    }
});

//////////////////////////////////////////////////////

//Routes user

app.post("/users", async (req, res) => {
    try {
        const parsedUser = CreateUserSchema.parse(req.body);
        const { username, password, email } = parsedUser;

        // Hachage du mot de passe avant de l'enregistrer
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        await sql`INSERT INTO users (username, password, email) VALUES (${username}, ${hashedPassword}, ${email})`;

        res.status(201).json({
            message: "Utilisateur créé avec succès",
            user: { username, email } // Ne jamais renvoyer le mot de passe
        });

    } catch (error) {
        console.error(error);
        res.status(400).json({ error: "Données invalides", details: error.message });
    }
});

app.get("/users", async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const users = await sql`SELECT * FROM users LIMIT ${limit} OFFSET ${offset}`;
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: "Erreur serveur", details: error.message });
    }
});

// Route PUT /users/:id - Met à jour un utilisateur entièrement
app.put("/users/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const parsedUser = UserSchema.partial().parse(req.body); // Autoriser les mises à jour partielles
        let { username, password, email } = parsedUser;

        if (password) {
            password = await bcrypt.hash(password, saltRounds);
        }

        const result = await sql`
        UPDATE users SET 
        username = COALESCE(${username}, username),
        password = COALESCE(${password}, password),
        email = COALESCE(${email}, email)
        WHERE id = ${id}`;

        if (result.count === 0) {
            return res.status(404).json({ error: "Utilisateur non trouvé" });
        }

        res.json({ message: "Utilisateur mis à jour avec succès" });

    } catch (error) {
        res.status(400).json({ error: "Données invalides", details: error.message });
    }
});

// Route PATCH /users/:id - Mise à jour partielle (ex: email)
app.patch("/users/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password, email } = req.body;

        // Vérifier si au moins un champ est fourni
        if (!username && !password && !email) {
            return res.status(400).json({ error: "Aucune donnée à mettre à jour" });
        }

        let updateFields = [];
        let updateValues = [];

        if (username) {
            updateFields.push("username = $" + (updateValues.length + 1));
            updateValues.push(username);
        }
        if (email) {
            updateFields.push("email = $" + (updateValues.length + 1));
            updateValues.push(email);
        }
        if (password) {
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            updateFields.push("password = $" + (updateValues.length + 1));
            updateValues.push(hashedPassword);
        }

        // Construire la requête SQL
        const query = `UPDATE users SET ${updateFields.join(", ")} WHERE id = $${updateValues.length + 1}`;
        updateValues.push(id);

        // Exécuter la requête
        const result = await sql.unsafe(query, updateValues);

        if (result.count === 0) {
            return res.status(404).json({ error: "Utilisateur non trouvé" });
        }

        res.json({ message: "Utilisateur mis à jour avec succès" });

    } catch (error) {
        res.status(400).json({ error: "Données invalides", details: error.message });
    }
});


app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
});


//////////////////////////////////////////////////////

//Routes f2g

// Base URL de l'API FreeToGame
const FREE_TO_GAME_API = "https://www.freetogame.com/api/";

// Route GET /f2p-games - Récupérer la liste des jeux
app.get("/f2p-games", async (req, res) => {
  try {
    const response = await fetch(`${FREE_TO_GAME_API}/games`);
    
    if (!response.ok) {
      throw new Error(`Erreur de l'API externe: ${response.statusText}`);
    }

    const games = await response.json();
    res.json(games);

  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des jeux", details: error.message });
  }
});

// Route GET /f2p-games/:id - Récupérer un jeu par son ID
app.get("/f2p-games/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const response = await fetch(`${FREE_TO_GAME_API}/game?id=${id}`);

    if (!response.ok) {
      throw new Error(`Erreur de l'API externe: ${response.statusText}`);
    }

    const game = await response.json();
    
    // Vérifier si un jeu est trouvé
    if (!game || Object.keys(game).length === 0) {
      return res.status(404).json({ error: "Jeu non trouvé" });
    }

    res.json(game);

  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération du jeu", details: error.message });
  }
});
