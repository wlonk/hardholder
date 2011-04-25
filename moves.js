var dateformat = require('dateformat'),
    flow = require('flow'),
    md = require('node-markdown').Markdown,
    MD_TAGS = 'b|blockquote|code|del|dd|dl|dt|em|h1|h2|h3|i|img|li|ol|p|pre|sup|sub|strong|strike|ul|br|hr',
    Mongoose = require('mongoose'),
    Schema = Mongoose.Schema,
    MoveSchema;

function slug(s) {
  return (s || '').replace(/[^a-zA-Z0-9]/g, '-').replace(/[-]+/g, '-').toLowerCase();
}

MoveSchema = new Schema({
  condition: {
    'default': '',
    type: String,
    validate: [
      function(v) {
        return (v || '').match(/\w/)
      },
      'empty'
    ]
  },
  definition: {
    get: function(defn) {
       return md(defn || '', MD_TAGS);
    },
    type: String
  },
  meta: {
    downvotes: {
      type: Number,
      'default': 0
    },
    slug: String,
    upvotes: {
      type: Number,
      'default': 0
    }
  },
  date: {
    'default': function() {
      return new Date();
    },
    type: String,
    get: function(date) {
      return dateformat(new Date(), 'dd mmm yyyy');
    }
  },
  stat: String
});

MoveSchema.pre('save', function(next) {
  this.meta.slug = slug(this.condition);
  next();
});
MoveSchema.virtual('url').get(function() {
  return '/moves/' + this.meta.slug;
});

MoveSchema.virtual('definition_url').get(function() {
  return '/moves/' + this.meta.slug  + '/' + this._id;
});
MoveSchema.virtual('id_url').get(function() {
  return '/moves/' + this._id;
});

Mongoose.model('Move', MoveSchema);

function validate(move) {
  var condition = move.condition || '',
      stat = move.stat || '',
      definition = move.definition || '';
  return !condition.match(/^\s*new\s*$/) && condition.match(/\w/) && stat.match(/\w/) && definition.match(/\w/);
}

module.exports.route = function(server, Move) {
  server.get('/moves', function(req, res) {
    var query = Move.find({});
    query.desc('date');
    query.limit(10);
    query.exec(function(err, moves) {
      res.render('moves/index', { locals: {
        moves: moves
      }});
    });
  });

  server.post('/moves', function(req, res) {
    var move = new Move(req.body && req.body.move);
    if (validate(move)) {
      move.save(function(err) {
        if (err) {
          res.redirect('/moves/new');
        } else {
          res.redirect(move.url);
        }
      });
    } else {
      res.redirect('/moves/new');
    }
  });

  server.get('/moves/new', function(req, res) {
    res.render('moves/new');
  });

  server.get('/moves/:slug', function(req, res) {
    var query = Move.find({ 'meta.slug': req.params.slug });
    query.desc('meta.upvotes');
    query.exec(function(err, moves) {
      if (moves.length === 0) {
        res.render('404', {
          locals: {
            condition: req.params.slug
          },
          status: 404 
        });
      } else {
        res.render('moves/index', {
          moves: moves
        });
      }
    });
  });
  
  server.post('/preview', function(req, res) {
    res.send(md(req.body.definition || '', MD_TAGS));
  });

  server.get('/moves/:id/up', function(req, res) {
    flow.exec(
      function() {
        Move.findById(req.params.id, this);
      },
      function(err, move) {
        move.meta.upvotes++;
        this.move = move;
        move.save(this);
      },
      function(err) {
        res.redirect(req.headers.referer);
      }
    );
  });
  
  server.get('/moves/:id/down', function(req, res) {
    flow.exec(
      function() {
        Move.findById(req.params.id, this);
      },
      function(err, move) {
        move.meta.downvotes++;
        this.move = move;
        move.save(this);
      },
      function(err) {
        res.redirect(req.headers.referer);
      }
    );
  });
};