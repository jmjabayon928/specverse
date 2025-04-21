import { Router, Request, Response } from "express";
import { poolPromise, sql } from "../config/db";

const router = Router();

// Get all clients
router.get("/", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query(
        "SELECT ClientID, ClientCode, ClientName, ClientEmail, ClientPhone, ClientAddress, ContactPerson FROM Clients"
      );
    res.json(result.recordset);
  } catch (error) {
    console.error("⛔ Database Error:", error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
});

// GET client by ID
router.get("/:id", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const clientId = parseInt(id, 10); // Convert string to number

    if (isNaN(clientId)) {
      return res.status(400).json({ error: "Invalid Client ID" });
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ClientID", sql.Int, clientId)
      .query(
        "SELECT ClientID, ClientCode, ClientName, ClientEmail, ClientPhone, ClientAddress, ContactPerson FROM Clients WHERE ClientID = @ClientID"
      );

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("⛔ Database Error:", error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
});

// Add a new client
router.post("/", async (req, res) => {
  try {
    const { ClientCode, ClientName, ClientEmail, ClientPhone, ClientAddress, ContactPerson } = req.body;

    if (!ClientCode || !ClientName || !ClientEmail) {
      return res.status(400).json({ error: "ClientCode, ClientName, and ClientEmail are required" });
    }

    const pool = await poolPromise;
    await pool
      .request()
      .input("ClientCode", sql.NVarChar, ClientCode)
      .input("ClientName", sql.NVarChar, ClientName)
      .input("ClientEmail", sql.NVarChar, ClientEmail)
      .input("ClientPhone", sql.NVarChar, ClientPhone)
      .input("ClientAddress", sql.NVarChar, ClientAddress)
      .input("ContactPerson", sql.NVarChar, ContactPerson)
      .query(
        "INSERT INTO Clients (ClientCode, ClientName, ClientEmail, ClientPhone, ClientAddress, ContactPerson, ClientLogo) VALUES (@ClientCode, @ClientName, @ClientEmail, @ClientPhone, @ClientAddress, @ContactPerson, 'client4.jpg')"
      );

    res.status(201).json({ message: "Client added successfully" });
  } catch (error) {
    console.error("⛔ Database Error:", error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { ClientName, ClientEmail, ClientPhone, ClientAddress, ContactPerson } = req.body;

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ClientID", sql.Int, id)
      .input("ClientName", sql.VarChar, ClientName)
      .input("ClientEmail", sql.VarChar, ClientEmail)
      .input("ClientPhone", sql.VarChar, ClientPhone)
      .input("ClientAddress", sql.VarChar, ClientAddress)
      .input("ContactPerson", sql.VarChar, ContactPerson)
      .query(
        `UPDATE Clients 
         SET ClientName = @ClientName, 
             ClientEmail = @ClientEmail, 
             ClientPhone = @ClientPhone, 
             ClientAddress = @ClientAddress, 
             ContactPerson = @ContactPerson 
         WHERE ClientID = @ClientID`
      );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json({ message: "Client updated successfully" });
  } catch (error) {
    console.error("⛔ Database Error:", error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("ClientID", sql.Int, id)
      .query("DELETE FROM Clients WHERE ClientID = @ClientID");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json({ message: "✅ Client deleted successfully" });
  } catch (error) {
    console.error("⛔ Database Error:", error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
});

export default router;
