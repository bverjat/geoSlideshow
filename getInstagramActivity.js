var ig = require('instagram-node').instagram();
var conf = require('./instaConfig.json');
var points = require('./app/data/data.json');
var async = require('async');
var fs = require('fs');
var _ = require('lodash');

var http = require('http');
var express = require('express');
var api = require('instagram-node').instagram();
var app = express();


var pts = _(points.features)
    .filter('type','Feature')
    .filter(function(d){return d.geometry.type === 'Point'})
    .filter(function(d){ return !_.isUndefined(d.geometry.coordinates) })
    .slice(0,3)
    .value();


api.use(conf);

var redirect_uri = 'http://localhost:3500/handleauth';



exports.authorize_user = function(req, res) {
  res.redirect(api.get_authorization_url(redirect_uri,  { scope:['basic','public_content'] }));
};

exports.handleauth = function(req, res) {
  api.authorize_user(req.query.code, redirect_uri, function(err, result) {
    if (err) {
      console.log(err.body);
      res.send("Didn't work");
    } else {
      console.log('Yay! Access token is ' + result.access_token);
      res.send('You made it!!');
      api.use({ access_token: result.access_token});

      var maxTime = Math.floor(Date.now() / 1000);
      var minTime = (maxTime - (60*60*24*30));

      async.eachSeries(pts, function iterator(item, next) {

        var coordinates = item.geometry.coordinates;
        console.log(coordinates);


        api.media_search(coordinates[0], coordinates[1], {
          distance:5000
        }, function(err, medias, remaining, limit) {
        console.log(err, medias, remaining, limit);

          console.log(medias);

         item.insta = {medias:medias};

        });

        saveData();
        setTimeout(next, 500);

      }, saveData);

      function saveData(){
        fs.writeFileSync("./app/data/data-insta.json", JSON.stringify(points, null, 2) );
      }

    }
  });
};

// This is where you would initially send users to authorize
app.get('/authorize_user', exports.authorize_user);
// This is your redirect URI
app.get('/handleauth', exports.handleauth);

http.createServer(app).listen("3500", function(){
  console.log("Express server listening on port " + app.get('port'));
});
