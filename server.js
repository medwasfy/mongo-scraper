var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var path = require("path");
// Note and Article models
var Note = require("./models/Note.js");
var Article = require("./models/Article.js");
// Scraping tools
var request = require("request");
var cheerio = require("cheerio");
// Set mongoose 
mongoose.Promise = Promise;
//Define port
// Initialize Express
var app = express();
// Use morgan and body parser 
app.use(logger("dev"));
app.use(bodyParser.urlencoded({
  extended: false
}));
// Make public a static dir
app.use(express.static("public"));
// Set Handlebars.
var exphbs = require("express-handlebars");
// Set Engine
app.engine("handlebars", exphbs({
  defaultLayout: "main",
  partialsDir: path.join(__dirname, "/views/layouts/partials")
}));
app.set("view engine", "handlebars");
// Database configuration 

mongoose.connect("mongodb://localhost/newsScraper");
var db = mongoose.connection;
// Show mongoose errors if any
db.on("error", function(error) {
  console.log("Mongoose Error: ", error);
});
// Log db through mongoose
db.once("open", function() {
  console.log("Mongoose UP and Running!");
});
// ===============================================================

// Routes
// ------

//GET requests to render Handlebars pages
app.get("/", function(req, res) {
  Article.find({"saved": false}, function(error, data) {
    var hbsObject = {
      article: data
    };
    console.log(hbsObject);
    res.render("home", hbsObject);
  });
});

app.get("/saved", function(req, res) {
  Article.find({"saved": true}).populate("notes").exec(function(error, articles) {
    var hbsObject = {
      article: articles
    };
    res.render("saved", hbsObject);
  });
});

// A GET request to scrape the echojs website
app.get("/scrape", function(req, res) {
  request("https://www.nytimes.com/section/world", function(error, response, html) {
    var $ = cheerio.load(html);
    $("div.story-body").each(function(i, element) {
      var result = {};
      result.title = $(this).children("h2.headline").text();
      result.link = $(this).children("h2.headline").children("a").attr("href");
      // Create new entry then save to the db
      var entry = new Article(result);
      entry.save(function(err, doc) {
        if (err) {
          console.log(err);
        }
        else {
          console.log(doc);
        }
      });
      
    });
    res.send("Scrape Successful!");
    
  });
});

// get All the articles we scraped from the db
app.get("/articles", function(req, res) {
  Article.find({}, function(error, doc) {
    if (error) {
      console.log(error);
    }
    else {
      res.json(doc);
    }
  });
});

// get article by id
app.get("/articles/:id", function(req, res) {
  Article.findOne({ "_id": req.params.id })
  .populate("note")
  .exec(function(error, doc) {
    if (error) {
      console.log(error);
    }
    else {
      res.json(doc);
    }
  });
});


// Save an article and update 
app.post("/articles/save/:id", function(req, res) {
  Article.findOneAndUpdate({ "_id": req.params.id }, { "saved": true})
  .exec(function(err, doc) {
    if (err) {
      console.log(err);
    }
    else {
      res.send(doc);
    }
  });
});

// Delete an article
app.post("/articles/delete/:id", function(req, res) {
  Article.findOneAndUpdate({ "_id": req.params.id }, {"saved": false, "notes": []})
  .exec(function(err, doc) {
    if (err) {
      console.log(err);
    }
    else {
      res.send(doc);
    }
  });
});


// Create a new note
app.post("/notes/save/:id", function(req, res) {
  var newNote = new Note({
    body: req.body.text,
    article: req.params.id
  });
  // console.log(req.body);
  // save the new note the db
  newNote.save(function(error, note) {
    // error log
    if (error) {
      console.log(error);
    }
    else {
      Article.findOneAndUpdate({ "_id": req.params.id }, {$push: { "notes": note } })
      .exec(function(err) {
        if (err) {
          console.log(err);
          res.send(err);
        }
        else {
          res.send(note);
        }
      });
    }
  });
});

// Delete a note
app.delete("/notes/delete/:note_id/:article_id", function(req, res) {
  Note.findOneAndRemove({ "_id": req.params.note_id }, function(err) {
    if (err) {
      console.log(err);
      res.send(err);
    }
    else {
      Article.findOneAndUpdate({ "_id": req.params.article_id }, {$pull: {"notes": req.params.note_id}})
      .exec(function(err) {
        if (err) {
          console.log(err);
          res.send(err);
        }
        else {
          res.send("Note Deleted");
        }
      });
    }
  });
});

// Listen on port
var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});

