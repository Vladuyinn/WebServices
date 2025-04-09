// All other imports here.
const { MongoClient } = require("mongodb");
const { ObjectId } = require("mongodb");
const express = require("express");
const z = require("zod");

const app = express();
const port = 8000;
const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());

// Product Schema + Product Route

// Schemas
const ProductSchema = z.object({
    _id: z.string(),
    name: z.string(),
    about: z.string(),
    price: z.number().positive(),
    categoryIds: z.array(z.string())
});
const CreateProductSchema = ProductSchema.omit({ _id: true });
const CategorySchema = z.object({
    _id: z.string(),
    name: z.string(),
});
const CreateCategorySchema = CategorySchema.omit({ _id: true });

app.post("/products", async (req, res) => {
    const result = await CreateProductSchema.safeParse(req.body);

    // If Zod parsed successfully the request body
    if (result.success) {
        const { name, about, price, categoryIds } = result.data;
        const categoryObjectIds = categoryIds.map((id) => new ObjectId(id));

        const ack = await db
            .collection("products")
            .insertOne({ name, about, price, categoryIds: categoryObjectIds });

        res.send({
            _id: ack.insertedId,
            name,
            about,
            price,
            categoryIds: categoryObjectIds,
        });
    } else {
        res.status(400).send(result);
    }
});

app.get("/products", async (req, res) => {
    const result = await db
        .collection("products")
        .aggregate([
            { $match: {} },
            {
                $lookup: {
                    from: "categories",
                    localField: "categoryIds",
                    foreignField: "_id",
                    as: "categories",
                },
            },
        ])
        .toArray();

    res.send(result);
});

// GET /products/:id - Lire un seul produit
app.get("/products/:id", async (req, res) => {
    try {
        const product = await db.collection("products").findOne({ _id: new ObjectId(req.params.id) });

        if (!product) {
            return res.status(404).send({ error: "Produit non trouvé" });
        }

        res.send(product);
    } catch (err) {
        res.status(400).send({ error: "ID invalide" });
    }
});

// PUT /products/:id - Mettre à jour un produit
app.put("/products/:id", async (req, res) => {
    const result = await CreateProductSchema.safeParse(req.body);
    if (!result.success) return res.status(400).send(result);

    try {
        const { name, about, price, categoryIds } = result.data;
        const categoryObjectIds = categoryIds.map((id) => new ObjectId(id));

        const ack = await db.collection("products").updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { name, about, price, categoryIds: categoryObjectIds } }
        );

        if (ack.matchedCount === 0) return res.status(404).send({ error: "Produit non trouvé" });

        res.send({ _id: req.params.id, name, about, price, categoryIds: categoryObjectIds });
    } catch (err) {
        res.status(400).send({ error: "ID invalide" });
    }
});

// DELETE /products/:id - Supprimer un produit
app.delete("/products/:id", async (req, res) => {
    try {
        const ack = await db.collection("products").deleteOne({ _id: new ObjectId(req.params.id) });

        if (ack.deletedCount === 0) return res.status(404).send({ error: "Produit non trouvé" });

        res.status(204).send(); // No content
    } catch (err) {
        res.status(400).send({ error: "ID invalide" });
    }
});

app.post("/categories", async (req, res) => {
    const result = await CreateCategorySchema.safeParse(req.body);

    // If Zod parsed successfully the request body
    if (result.success) {
        const { name } = result.data;

        const ack = await db.collection("categories").insertOne({ name });

        res.send({ _id: ack.insertedId, name });
    } else {
        res.status(400).send(result);
    }
});

// Init mongodb client connection
client.connect().then(() => {
    // Select db to use in mongodb
    db = client.db("myDB");
    app.listen(port, () => {
        console.log(`Listening on http://localhost:${port}`);
    });
});



