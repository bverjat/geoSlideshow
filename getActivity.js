
const Twitter = require('twitter-node-client').Twitter;
const async = require('async');
const config = require('./twitterConfig.json');
const points = require('./app/data/data.json');

const fs = require('fs');
const _ = require('lodash');

//Callback functions
function error (err, response, body) { console.log('ERROR', body ); };

const twitter = new Twitter(config);

const pts = _(points.features)
    .filter('type','Feature')
    .filter(function(d){return d.geometry.type === 'Point'})
    .filter(function(d){ return !_.isUndefined(d.geometry.coordinates) })
    // .slice(0,3)
    .value();

async.eachSeries(pts, function iterator(item, next) {

  var coordinates = item.geometry.coordinates;
  console.log(coordinates);

  twitter.getSearch({
    'q':' ',
    'geocode':''+coordinates[0]+','+coordinates[1]+',50km',
    'count': 100,
    'result\_type':'recent'
  }, error, function(data){
    item.res = JSON.parse(data);
    console.log(item.res.statuses.length);
  });

  saveData();
  setTimeout(next, 3000);

}, saveData);

function saveData(){
  fs.writeFileSync("./app/data/data-tweets.json", JSON.stringify(points, null, 2) );
}
