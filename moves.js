var dateformat = require('dateformat'),
    flow = require('flow'),
    md = require('node-markdown').Markdown,
    MD_TAGS = 'b|em|i|li|ol|p|strong|ul|br|hr',
    Mongoose = require('mongoose'),
    Schema = Mongoose.Schema,
    _ = require('underscore'),
    MoveSchema;

function slug(s) {
  return (s || '').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').replace(/[-]+/g, '-').toLowerCase();
}

function getOffset(page) {
  page = page || 1;
  if (page < 1) {
    page = 1;
  }
  return (page - 1) * 50;
}

function parseTags(tags) {
  tags = _.isArray(tags) ? tags.join(' ') : tags || '';
  return _.map(_.compact(tags.split(/\s+/)), function(tag) {
    return tag.replace(/[^a-z0-9-_]/gi, '');    
  });
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
  ts: {
    'default': function() {
      return new Date().getTime();
    },
    index: true,
    type: Number
  },
  stat: {
    type: String
  },
  authors: String,
  source: String,
  tags: {
    'default': [],
    index: true,
    set: function(tags) {
      return parseTags(tags);
    },
    type: [String]
  }
});

MoveSchema.pre('save', function(next) {
  this.meta.slug = slug(this.condition);
  next();
});
MoveSchema.virtual('url').get(function() {
  return '/moves/' + this.meta.slug;
});

MoveSchema.virtual('definition_markdown').get(function() {
  return md(this.definition || '', MD_TAGS);
});

MoveSchema.virtual('edit_url').get(function() {
  return '/moves/' + this._id + '/edit';
});

MoveSchema.virtual('definition_url').get(function() {
  return '/moves/' + this.meta.slug  + '/' + this._id;
});
MoveSchema.virtual('id_url').get(function() {
  return '/moves/' + this._id;
});
MoveSchema.virtual('date_display').get(function() {
  return dateformat(new Date(this.ts), 'dd mmm yyyy');
});

Mongoose.model('Move', MoveSchema);

function validate(move) {
  var condition = move.condition || '',
      stat,
      definition = move.definition || '',
      roll,
      errors = [];
  
  roll = definition.match(/roll\s?[+]\s?(\w+)/i);
  move.stat = stat = (roll && roll[1]) || '';
  
  if (condition.match(/^\s*new\s*$/)) {
    errors.push('Title cannot be "new".');
  }
  if (!condition.match(/\w/)) {
    errors.push('Title cannot be blank.');
  }
  if (!stat.match(/\w/)) {
    errors.push('Definition must include what to roll, such as "roll +hot".');    
  }
  if (!definition.match(/On\s+(a\s+)?7\s?-\s?9/i)) {
    errors.push('Definition must include "on a 7-9".');
  }
  if (!definition.match(/On\s+(a\s+)?10[+]/i)) {
    errors.push('Definition must include "On 10+".')
  }
  return errors;
}

module.exports.route = function(server, Move) {
  server.get('/moves', function(req, res) {
    var query = Move.find()
      .desc('ts')
      .limit(50)
      .run(function(err, moves) {
        res.header('Cache-Control', 'no-cache');
        res.render('moves/index', { locals: {
          moves: moves
        }});
    });
  });

  server.post('/moves', function(req, res) {
    var move = new Move(req.body && req.body.move),
        errors = validate(move);
    if (errors.length === 0) {
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

  server.post('/moves/:id', function(req, res) {
    Move.findById(req.params.id, function(err, move) {
      move = _.extend(move, req.body.move);
      move.save(function(err) {
        if (err) {
          res.render('moves/edit', {
            locals: {
              move: move
            }
          });
        } else {
          res.redirect(move.url);
        }
      });
    });
  });
  
  server.get('/moves/new', function(req, res) {
    res.render('moves/new', {
      locals: {
        context: 'new'
      }
    });
  });

  server.get('/moves/tagged/:tags', function(req, res) {
    var offset = getOffset(req.params.page),
        tags = parseTags(req.params.tags);
    if (tags.length === 0) {
      res.redirect('/moves');
    } else {
      Move.find({ tags: { $all: tags } }).desc('ts').limit(50).skip(offset).run(function(err, moves) {
        res.render('moves/index', {
          locals: {
            moves: moves,
            tags: tags.join(' ')
          }
        });
      });  
    }
  });
  
  server.get('/moves/rss', function(req, res) {
    var query = Move.find()
      .desc('ts')
      .limit(50)
      .run(function(err, moves) {
        res.header('Content-Type', 'application/xml; charset=utf-8');
        res.header('Cache-Control', 'no-cache');
        res.render('moves/rss', { locals: {
          layout: false,
          moves: moves
        }});
    });
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
    var move = new Move(req.body.move),
        errors = validate(move);

    res.render('moves/preview', {
      layout: false,
      locals: {
        errors: errors,
        move: move
      }
    })
  });

  function vote(req, res, vote) {
    flow.exec(
      function() {
        Move.findById(req.params.id, this);
      },
      function(err, move) {
        if (move) {
          move.meta[vote]++;
          this.move = move;
          move.save(this);
        } else {
          this();
        }
      },
      function(err) {
        res.redirect(req.headers.referer || '/moves');
      }
    );
  }
  server.get('/moves/:id/up', function(req, res) {
    vote(req, res, 'upvotes');
  });
  
  server.get('/moves/:id/down', function(req, res) {
    vote(req, res, 'downvotes');
  });

  server.get('/moves/:id/edit', function(req, res) {
    Move.findById(req.params.id, function(err, move) {
      res.render('moves/edit.jade', {
        locals: {
          move: move
        }
      });        
    });
  });
};
