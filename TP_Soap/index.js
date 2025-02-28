const soap = require("soap");
const fs = require("node:fs");
const http = require("http");
const postgres = require("postgres");

const sql = postgres({ db: "mydb", user: "utilisateur", password: "pass", port: 5433 });

// Define the service implementation
const service = {
    ProductsService: {
        ProductsPort: {
            CreateProduct: async function ({ name, about, price }, callback) {
                if (!name || !about || !price) {
                    throw {
                        Fault: {
                            Code: {
                                Value: "soap:Sender",
                                Subcode: { value: "rpc:BadArguments" },
                            },
                            Reason: { Text: "Processing Error" },
                            statusCode: 400,
                        },
                    };
                }

                const product = await sql`
                    INSERT INTO products (name, about, price)
                    VALUES (${name}, ${about}, ${price})
                    RETURNING *;
                `;

                callback(null, product[0]);
            },

            GetProducts: async function (_, callback) {
                try {
                    const products = await sql`SELECT * FROM products`;

                    callback(null, products.map(product => ({
                        id: product.id,
                        name: product.name,
                        about: product.about,
                        price: product.price
                    })));
                } catch (error) {
                    callback(error);
                }
            },
            PatchProduct: async function ({ id, name, about, price }, callback) {
                console.log("Received PatchProduct request:", { id, name, about, price });
            
                try {
                    if (!id) {
                        throw {
                            Fault: {
                                Code: { Value: "soap:Sender" },
                                Reason: { Text: "Missing product ID" },
                                statusCode: 400,
                            },
                        };
                    }
            
                    const updatedProduct = await sql`
                        UPDATE products
                        SET 
                            name = COALESCE(${name}, name),
                            about = COALESCE(${about}, about),
                            price = COALESCE(${price}, price)
                        WHERE id = ${id}
                        RETURNING *;
                    `;
            
                    if (updatedProduct.length === 0) {
                        throw {
                            Fault: {
                                Code: { Value: "soap:Sender" },
                                Reason: { Text: "Product not found" },
                                statusCode: 404,
                            },
                        };
                    }
            
                    callback(null, updatedProduct[0]);
                } catch (error) {
                    console.error("PatchProduct Error:", error);
                    callback(error);
                }
            },

            DeleteProduct: async function ({ id }, callback) {
                console.log("Received DeleteProduct request:", { id });
            
                try {
                    if (!id) {
                        throw {
                            Fault: {
                                Code: { Value: "soap:Sender" },
                                Reason: { Text: "Missing product ID" },
                                statusCode: 400,
                            },
                        };
                    }
            
                    const deletedProduct = await sql`
                        DELETE FROM products WHERE id = ${id} RETURNING *;
                    `;
            
                    if (deletedProduct.length === 0) {
                        throw {
                            Fault: {
                                Code: { Value: "soap:Sender" },
                                Reason: { Text: "Product not found" },
                                statusCode: 404,
                            },
                        };
                    }
            
                    callback(null, { message: "Product deleted successfully" });
                } catch (error) {
                    console.error("DeleteProduct Error:", error);
                    callback(error);
                }
            },
        },
    },
};


// http server example
const server = http.createServer(function (request, response) {
    response.end("404: Not Found: " + request.url);
});

server.listen(8000);

// Create the SOAP server
const xml = fs.readFileSync("productsService.wsdl", "utf8");
soap.listen(server, "/products", service, xml, function () {
    console.log("SOAP server running at http://localhost:8000/products?wsdl");
});