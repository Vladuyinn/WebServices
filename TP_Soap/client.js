const soap = require("soap");

soap.createClient("http://localhost:8000/products?wsdl", {}, function (err, client) {
  if (err) {
    console.error("Error creating SOAP client:", err);
    return;
  }

  // Créer un produit
  // client.CreateProduct({ name: "My product", about: "test", price: "10" }, function (err, result) {
  //   if (err) {
  //     console.error("Error making SOAP request:", err);
  //     return;
  //   }
  //   console.log("Product Created:", result);
  // });

  // Récupérer tous les produits
  client.GetProducts({}, function (err, result) {
    if (err) {
      console.error("Error fetching products:", err);
      return;
    }
    console.log("All Products:", result);
  });

  // Mettre à jour un produit
  // client.PatchProduct({ id: "2", name: "Updated Name", about: "", price: "20"}, function (err, result) {
  //   if (err) {
  //     console.error("Error updating product:", err);
  //     return;
  //   }
  //   console.log("Updated Product:", result);
  // });

  // Supprimer un produit
  // client.DeleteProduct({ id: "2" }, function (err, result) {
  //   if (err) {
  //     console.error("Error deleting product:", err);
  //     return;
  //   }
  //   console.log(result);
  // });
});