const express = require("express");
const postgres = require("postgres");
const z = require("zod");

const bcrypt = require("bcrypt");
const saltRounds = 10; // Niveau de hachage

const app = express();
const port = 8000;
const sql = postgres({ db: "mydb", user: "user", password: "password", port: "5433" });
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// Définition des options de la documentation
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Mon API REST",
      version: "1.0.0",
      description: "Documentation de l'API avec Swagger",
    },
    servers: [
      {
        url: "http://localhost:8000",
        description: "Serveur de développement",
      },
    ],
  },
  apis: ["./index.js"], // Fichier où se trouvent les routes
};

// Générer la documentation Swagger
const swaggerDocs = swaggerJsdoc(swaggerOptions);

// Ajouter la route Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

console.log("📄 Documentation Swagger disponible sur : http://localhost:8000/api-docs");

//////////////////////////////////////////////////////////////////

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

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Récupérer un produit spécifique
 *     description: Retourne un produit par son ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID du produit
 *     responses:
 *       200:
 *         description: Succès - Produit trouvé
 *       404:
 *         description: Erreur - Produit non trouvé
 */

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

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Récupérer tous les produits
 *     description: Retourne la liste de tous les produits avec pagination et filtres.
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filtrer par nom de produit
 *       - in: query
 *         name: about
 *         schema:
 *           type: string
 *         description: Filtrer par description
 *       - in: query
 *         name: price
 *         schema:
 *           type: number
 *         description: Filtrer par prix maximum
 *     responses:
 *       200:
 *         description: Succès - Retourne la liste des produits
 */

app.get("/products", async (req, res) => {
    try {
        const { name, about, price } = req.query;

        let conditions = [];
        let values = [];

        if (name) {
            conditions.push(`name ILIKE $${values.length + 1}`);
            values.push(`%${name}%`);
        }

        if (about) {
            conditions.push(`about ILIKE $${values.length + 1}`);
            values.push(`%${about}%`);
        }

        if (price) {
            conditions.push(`price <= $${values.length + 1}`);
            values.push(price);
        }

        // Construire dynamiquement la requête SQL
        const query = `
        SELECT * FROM products
        ${conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : ""}
      `;

        const products = await sql.unsafe(query, values);
        res.json(products);

    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la recherche", details: error.message });
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

//////////////////////////////////////////////////////

//Routes orders

// Route POST /orders - Créer une nouvelle commande

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Créer une commande
 *     description: Crée une nouvelle commande avec une liste de produits.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *               productIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       201:
 *         description: Commande créée avec succès
 *       400:
 *         description: Données invalides
 */

app.post("/orders", async (req, res) => {
    try {
        const { userId, productIds } = req.body;

        if (!userId || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ error: "Données invalides" });
        }

        // Récupérer les prix des produits sélectionnés
        const products = await sql`SELECT id, price FROM products WHERE id = ANY(${productIds})`;

        if (products.length !== productIds.length) {
            return res.status(400).json({ error: "Un ou plusieurs produits sont invalides" });
        }

        // Calculer le total avec la TVA (1.2)
        const total = products.reduce((sum, p) => sum + p.price, 0) * 1.2;

        const newOrder = {
            userId,
            productIds,
            total,
            payment: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Insérer la commande en base
        await sql`
      INSERT INTO orders (userId, productIds, total, payment, createdAt, updatedAt) 
      VALUES (${newOrder.userId}, ${newOrder.productIds}, ${newOrder.total}, ${newOrder.payment}, ${newOrder.createdAt}, ${newOrder.updatedAt})
    `;

        res.status(201).json( newOrder );

    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la création de la commande", details: error.message });
    }
});

// Route GET /orders - Récupérer toutes les commandes
app.get("/orders", async (req, res) => {
    try {
        const orders = await sql`SELECT * FROM orders`;
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la récupération des commandes", details: error.message });
    }
});

// Route GET /orders/:id - Récupérer une commande spécifique avec détails utilisateur et produits
app.get("/orders/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Récupérer la commande
        const orders = await sql`SELECT * FROM orders WHERE id = ${id}`;
        if (orders.length === 0) {
            return res.status(404).json({ error: "Commande non trouvée" });
        }

        const order = orders[0];

        // Récupérer les informations de l'utilisateur
        const users = await sql`SELECT id, username, email FROM users WHERE id = ${order.userId}`;
        const user = users[0] || null;

        // Récupérer les informations des produits
        const products = await sql`SELECT * FROM products WHERE id = ANY(${order.productids})`;

        res.json({ ...order, user, products });

    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la récupération de la commande", details: error.message });
    }
});

// Route DELETE /orders/:id - Supprimer une commande
app.delete("/orders/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await sql`DELETE FROM orders WHERE id = ${id}`;

        if (result.count === 0) {
            return res.status(404).json({ error: "Commande non trouvée" });
        }

        res.json({ message: "Commande supprimée avec succès" });

    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la suppression de la commande", details: error.message });
    }
});

//////////////////////////////////////////////////////

//Routes reviews

// Route POST /reviews - Ajouter un avis

/**
 * @swagger
 * /reviews:
 *   get:
 *     summary: Récupérer tous les avis
 *     description: Retourne la liste de tous les avis.
 *     responses:
 *       200:
 *         description: Liste des avis récupérée avec succès
 */

app.post("/reviews", async (req, res) => {
    try {
        const { userId, productId, score, content } = req.body;

        if (!userId || !productId || !score || !content || score < 1 || score > 5) {
            return res.status(400).json({ error: "Données invalides" });
        }

        // Insérer l'avis
        const result = await sql`
        INSERT INTO reviews (userId, productId, score, content)
        VALUES (${userId}, ${productId}, ${score}, ${content})
        RETURNING *`;

        console.log("Résultat de l'insertion :", result);

        // Mettre à jour la moyenne des scores du produit
        await sql`
        UPDATE products
        SET averageScore = (SELECT AVG(score) FROM reviews WHERE productId = ${productId})
        WHERE id = ${productId}`;

        res.status(201).json( result[0] );

    } catch (error) {
        res.status(500).json({ error: "Erreur lors de l'ajout de l'avis", details: error.message });
    }
});

//GET reviews

app.get("/reviews", async (req, res) => {
    try {
      const reviews = await sql`
        SELECT r.id, r.userId, u.username, r.productId, p.name AS productName, r.score, r.content, r.createdAt, r.updatedAt
        FROM reviews r
        JOIN users u ON r.userId = u.id
        JOIN products p ON r.productId = p.id
        ORDER BY r.createdAt DESC`;
  
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: "Erreur lors de la récupération des avis", details: error.message });
    }
  });
  

// Route GET /products/:id - Inclure les avis d'un produit
app.get("/products/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Récupérer le produit
        const products = await sql`SELECT * FROM products WHERE id = ${id}`;
        if (products.length === 0) {
            return res.status(404).json({ error: "Produit non trouvé" });
        }
        const product = products[0];

        // Récupérer les avis du produit
        const reviews = await sql`SELECT * FROM reviews WHERE productId = ${id}`;

        res.json({ ...product, reviews });

    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la récupération du produit", details: error.message });
    }
});