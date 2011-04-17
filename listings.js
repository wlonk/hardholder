var flow = require('flow'),
    Mongoose = require('mongoose'),
    Schema = Mongoose.Schema,
    ListingSchema;

ListingSchema = new Schema({
  date: Date,
  description: String,
  failure: String,
  meta: {
    move_slug: String,
    upvotes: Number,
    downvotes: Number
  },
  partial: String,
  stat: String,
  success: String
});

ListingSchema.path('date').default(function() {
  return new Date();
});

ListingSchema.path('meta.upvotes').default(function() {
  return 0;
});

ListingSchema.path('meta.downvotes').default(function() {
  return 0;
});

ListingSchema.virtual('url').get(function() {
  return '/listings/' + this._id;
});

Mongoose.model('Listing', ListingSchema);

module.exports.route = function(app, Move, Listing) {
  app.get('/listings/:id/up', function(req, res) {
    var id = req.params.id;
    Listing.findById(id, function(err, listing) {
      listing.meta.upvotes++;
      listing.save(function() {
        updateTopListing(listing.meta.move_slug);
        res.redirect('/moves/' + listing.meta.move_slug);
      });
    });
  });
  app.get('/listings/:id/down', function(req, res) {
    var id = req.params.id;
    Listing.findById(id, function(err, listing) {
      listing.meta.downvotes++;
      listing.save(function() {
        updateTopListing(listing.meta.move_slug);
        res.redirect('/moves/' + listing.meta.move_slug);
      });
    });
  });
  function updateTopListing(slug) {
    var query = Listing.find({ 'meta.move_slug': slug });
    query.desc('meta.upvotes');
    query.limit(1);
    query.exec(function(err, listings) {
      var listing = listings[0];
      if (listing) {
        if (!err && listing) {
          Move.findOne({ slug: slug }, function(err, move) {
            move.toplisting = listing._id;
            move.save();
          })
        }
      }
    });
  }

  app.get('/moves/:slug/listings/new', function(req, res) {
    var slug = req.params.slug;
    Move.findOne({ slug: slug }, function(err, move) {
      res.render('listings/new', {
        locals: {
          move: move
        }
      });
    });
  });

  app.post('/moves/:slug/listings', function(req, res) {
    var listing,
        slug = req.params.slug;
    Move.findOne({ slug: slug }, function(err, move) {
      listing = new Listing(req.body.listing);
      listing.meta.move_slug = move.slug;
      listing.save(function(err) {
        if (err) {
          console.log(err);
        } else {
          updateTopListing(slug);
          res.redirect(move.url);
        }
      });
    });
  });
};
