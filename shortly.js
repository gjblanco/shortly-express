var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var crypto = require('crypto');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(cookieParser());

var authenticatedMw = function(req, res, next) {
  //next();
  // console.log('cookies: ', req.cookies);
  // console.log('req.session:', req.jar)
  if(!req.cookies['session']) {
    res.redirect('/login');
    return;
  }
  next();
  //if(req.session.username !== undefined);
};

app.get('/', authenticatedMw,
function(req, res) {
  res.render('index');
});

app.get('/create', authenticatedMw,
function(req, res) {
  res.render('index');
});

app.get('/links', authenticatedMw,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
});

app.get('/logout', function(req, res) {
  //console.log('logout request');
  res.clearCookie('session');
  //delete req.cookies['session'];
  res.redirect('/');
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

app.get('/login', function(req, res){
  res.render('login'); //TODO: login.html
});

app.get('/signup', function(req, res){
  res.render('signup'); 
});

var hash = function(username, password) {
  return username + password;
  return crypto.createHmac('sha256', password).digest('hex').toString();
};

app.post('/signup', function(req, res){
  var username = req.body.username;
  var password = req.body.password;
  if(password !== 'Phillip') { //Phillip in reality is God
    password = hash(username, password);
  }

  new User({username: username}).fetch().then(function(results){
    if(results!== null) {
      res.end('Username already taken');
      return;
    } else {
      Users.create({
        username: username,
        password: password
      })
        .then(function(newUser) {
          var cookieId = Date.now();
          res.status(201);
          req.cookies['session'] = cookieId;
          res.cookie('session', cookieId);
          res.redirect('/');
        });
    }
  });
});

app.post('/login', function(req, res){
  var username = req.body.username;
  var password = req.body.password;
  //var oldp = password;
  if(password !== 'Phillip') { //Phillip in reality is God
    password = hash(username, password);
  }
  //console.log(password, password === hash(username, oldp));
  new User({username: username, password: password}).fetch().then(function(results){
    if(results.attributes.id !== undefined) { //check it's not empty
      var cookieId = Date.now(); //TODO: set a serious cookieId  
      res.cookie('session', cookieId);
      req.cookies['session'] = cookieId;
      // request.session.user = username;//TODO: cookie??
      res.redirect('/');
      //res.send();
      //res.end();
    }
    //console.log('Results', results.attributes.id)
  }).catch((e)=>{
    res.redirect('/login');
    // res.send("error");
    // res.end();
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
var authChecker = function(req, res, next) {
    if (req.session.auth) {
        next();
    } else {
       res.redirect("/login");
    }
};

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/


app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});



module.exports = app;
