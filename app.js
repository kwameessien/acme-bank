const Database = require("better-sqlite3");
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const path = require("path");
const fs = require("fs");

const db = new Database("./bank_sample.db");

const app = express();
const PORT = 3000;
app.use(helmet());
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "secret",
    resave: true,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/", function (request, response) {
  response.sendFile(path.join(__dirname + "/html/login.html"));
});

//LOGIN SQL
app.post("/auth", function (request, response) {
  var username = request.body.username;
  var password = request.body.password;
  if (username && password) {
    try {
      const results = db
        .prepare(
          `SELECT * FROM users WHERE username = '${request.body.username}' AND password = '${request.body.password}'`
        )
        .get();
      console.log(results);
      if (results) {
        request.session.loggedin = true;
        request.session.username = results["username"];
        request.session.balance = results["balance"];
        request.session.file_history = results["file_history"];
        request.session.account_no = results["account_no"];
        response.redirect("/home");
      } else {
        response.send("Incorrect Username and/or Password!");
      }
    } catch (error) {
      console.log(error);
      response.send("Incorrect Username and/or Password!");
    }
    response.end();
  } else {
    response.send("Please enter Username and Password!");
    response.end();
  }
});

//Home Menu No Exploits Here.
app.get("/home", function (request, response) {
  if (request.session.loggedin) {
    username = request.session.username;
    balance = request.session.balance;
    response.render("home_page", { username, balance });
  } else {
    response.redirect("/");
  }
  response.end();
});

//CSRF CODE SECURED. SEE HEADERS SET ABOVE
app.get("/transfer", function (request, response) {
  if (request.session.loggedin) {
    var sent = "";
    response.render("transfer", { sent });
  } else {
    response.redirect("/");
  }
});

//CSRF CODE
app.post("/transfer", function (request, response) {
  if (request.session.loggedin) {
    console.log("Transfer in progress");
    var balance = request.session.balance;
    var account_to = parseInt(request.body.account_to);
    var amount = parseInt(request.body.amount);
    var account_from = request.session.account_no;
    if (account_to && amount) {
      if (balance > amount) {
        try {
          db.prepare(
            `UPDATE users SET balance = balance + ${amount} WHERE account_no = ${account_to}`
          ).run();
          db.prepare(
            `UPDATE users SET balance = balance - ${amount} WHERE account_no = ${account_from}`
          ).run();
          var sent = "Money Transfered";
          response.render("transfer", { sent });
        } catch (error) {
          console.log(error);
          var sent = "Transfer failed.";
          response.render("transfer", { sent });
        }
      } else {
        var sent = "You Don't Have Enough Funds.";
        response.render("transfer", { sent });
      }
    } else {
      var sent = "";
      response.render("transfer", { sent });
    }
  } else {
    response.redirect("/");
  }
});

//PATH TRAVERSAL CODE
app.get("/download", function (request, response) {
  if (request.session.loggedin) {
    file_name = request.session.file_history;
    response.render("download", { file_name });
  } else {
    response.redirect("/");
  }
  response.end();
});

app.post("/download", function (request, response) {
  if (request.session.loggedin) {
    var file_name = request.body.file;

    response.statusCode = 200;
    response.setHeader("Content-Type", "text/html");

    // Change the filePath to current working directory using the "path" method
    const filePath = "history_files/" + file_name;
    console.log(filePath);
    try {
      content = fs.readFileSync(filePath, "utf8");
      response.end(content);
    } catch (err) {
      console.log(err);
      response.end("File not found");
    }
  } else {
    response.redirect("/");
  }
  response.end();
});

//XSS CODE
app.get("/public_forum", function (request, response) {
  if (request.session.loggedin) {
    const rows = db.prepare(`SELECT username,message FROM public_forum`).all();
    console.log(rows);
    response.render("forum", { rows });
  } else {
    response.redirect("/");
  }
});

app.post("/public_forum", function (request, response) {
  if (request.session.loggedin) {
    var comment = request.body.comment;
    var username = request.session.username;
    if (comment) {
      try {
        db.prepare(
          `INSERT INTO public_forum (username,message) VALUES ('${username}','${comment}')`
        ).run();
      } catch (err) {
        console.log(err);
      }
    }
    const rows = db.prepare(`SELECT username,message FROM public_forum`).all();
    console.log(rows);
    response.render("forum", { rows });
  } else {
    response.redirect("/");
  }
});

//SQL UNION INJECTION
app.get("/public_ledger", function (request, response) {
  if (request.session.loggedin) {
    var id = request.query.id;
    let rows;
    if (id) {
      rows = db
        .prepare(`SELECT * FROM public_ledger WHERE from_account = '${id}'`)
        .all();
      console.log("PROCESSING INPUT");
    } else {
      rows = db.prepare(`SELECT * FROM public_ledger`).all();
    }
    response.render("ledger", { rows: rows || [] });
  } else {
    response.redirect("/");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});
