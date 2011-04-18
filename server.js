var express = require('express'),
    server = express.createServer(),
    _ = require('underscore'),
    Mongoose = require('mongoose'),
    db = Mongoose.connect('mongodb://localhost/db'),
    port = 80,
    no_listen;

server.configure(function() {
  server.use(express.logger());
  server.use(express.bodyParser());
  server.use(express.methodOverride());
  server.use(express.static(__dirname + '/static'))
});

server.configure('development', function() {
  server.use(express.errorHandler({
    dumpExceptions: true,
    showStack: true
  }));
  port = 3000;
});

server.configure('test', function() {
  no_listen = true;
  module.exports.server = server;
})
server.set('views', __dirname + '/views');
server.set('view engine', 'jade');

server.get('/', function(req, res) {
  res.redirect('/moves');
});

var moves = require('./moves'),
    Move = db.model('Move');
moves.route(server, Move);
                   
if (!no_listen) {
server.listen(port);  
}

