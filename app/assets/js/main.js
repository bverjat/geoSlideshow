'use strict';

function initialize() {
  $.getJSON( 'data/data.json', function(data) {

    // STATE AND TREE //////////////////////////////////////////////////////////
    var templates = getTemplates();
    var monkey = Baobab.monkey;

    var storageKey = 'NOF';
    var storageData = JSON.parse(localStorage.getItem(storageKey) || '{}');

    var state = {

      points:getPoints(data.features),
      pointId:0,
      point: Baobab.monkey(['pointId'],['points'], function(id, points) {
        return points[id] || null;
      }),
      distance: 2000,
      heading: 50,

      pitch: 50,
      pitchSpeed: 0.05,
      pitchMax: 40,
      pitchMin: -20,
      pitchCenter:monkey({ cursors: { max: ['pitchMax'], min: ['pitchMin']},
        get: function(data) { return (data.max + data.min)/2 }
      }),

      targetMarker:{}

    };


    var tree = new Baobab(_.merge({},storageData,state),{lazyMonkeys:false});
    window.tree = tree;

    console.log(storageData, tree.get());


    var points = tree.select('points')
        points.on('update', updateStorage)
    var pointId = tree.select('pointId');
        pointId.on('update', function(e){

          var point = tree.get('point');
          console.log(point);

          sv.getPanorama({location:point, radius: 1000}, processSVData);
          map.setCenter(point);

          $('#activity').html(templates.activity( tree.get() ));
          $('#pointInfo').html(templates.pointInfo( tree.get() ));
          $('#currentId, #slideId').val(tree.get('pointId'));

          updateInstagram()
        })

    var distance = tree.select('distance');
        distance.on('update', function(e){
          updateInstagram();
          $('#currentDistance, #slideDistance').val(distance.get());
        })

    var pitchSpeed = tree.select('pitchSpeed');
    tree.select('pitch').on('update', updatePanoramaPov);
    tree.select('heading').on('update', updatePanoramaPov);

    // INIT ////////////////////////////////////////////////////////////////////

    var pitchAnim = setInterval(pitchAnimate,10);

    // slides an controls
    $( '#slideId' ).attr('max', tree.get('points').length );
    $( '#currentId, #slideId' ).change(function() { tree.set('pointId', parseInt( $( this ).val() ) );});
    $( '#currentDistance, #slideDistance' ).change(function() { tree.set('distance', parseInt( $( this ).val() ) );});


    // key actions
    $( 'body' ).keypress(function( event ) {
      if ( event.which == 106 ) { tree.select('pointId').apply(next);}
      else if ( event.which == 107 ) { tree.select('pointId').apply(prev);}
    });

    // instagram feed listenner
    $('.instagram').on('didLoadInstagram', onInstagramDidLoad);

    // maps and panorama objects
    var map = new google.maps.Map(document.getElementById('map'), {
      center: tree.get('points')[0],
      zoom: 17, streetViewControl: true, mapTypeId: google.maps.MapTypeId.SATELLITE
    });
    var panorama = new google.maps.StreetViewPanorama(document.getElementById('pano'));;
    var sv = new google.maps.StreetViewService();

    // marker indexation
    var targetMarkerIndex = getMarkers(tree.get('points'), map);

    tree.select('pointId').emit('update');
    distance.emit('update');

    // MAP UTILS ///////////////////////////////////////////////////////////////

    function updatePanoramaPov(){
      panorama.setPov({heading:tree.get('heading'), pitch: tree.get('pitch') });
      map.setStreetView(panorama);
    }

    function pitchAnimate(){
      var pitch = tree.get('pitch');

      if(pitch > tree.get('pitchMax') || pitch < tree.get('pitchMin') ){
       pitchSpeed.apply(negate);
      }

      tree.set('pitch', pitch + pitchSpeed.get() );
    }

    function processSVData(data, status) {

      if (!_.isNull(data)) {

        clearInterval(pitchAnim);

        var viewpointMarker = new google.maps.Marker({ map: map, position: data.location.latLng });
        var targetMarker = targetMarkerIndex[tree.get('pointId')];

        // update panorama
        tree.set('heading',google.maps.geometry.spherical.computeHeading(viewpointMarker.getPosition(), targetMarker.getPosition()))
        tree.set('pitch', tree.get('pitchCenter'))
        pitchSpeed.apply(abs);


        panorama.setPano(data.location.pano);
        panorama.setVisible(true);

        // unset pegman marker
        viewpointMarker.setMap(null);

        // map bounds
        var bounds = new google.maps.LatLngBounds();
        bounds.extend(viewpointMarker.getPosition());
        bounds.extend(targetMarker.getPosition());
        map.fitBounds(bounds);

        pitchAnim = setInterval(pitchAnimate,10);

      }else{
        panorama.setVisible(false);
      }
    }

    // INSTAGRAM
    function updateInstagram(){
      $('.instagram').instagram({
        search: { lat: tree.get('point','lat'), lng: tree.get('point','lng'), distance: tree.get('distance')},
        clientId: 'baee48560b984845974f6b85a07bf7d9'
      });
    }

    function onInstagramDidLoad(event, response, req){
      // sort by distance from current point
      response.data = _.sortBy(response.data, function(d){
        var x1 = d.location.latitude;
        var y1 = d.location.longitude;
        var x2 = tree.get('point','lat');
        var y2 = tree.get('point','lng');;
        var d = Math.sqrt( (x1-x2)*(x1-x2) + (y1-y2)*(y1-y2) );
        return d
      })

      tree.set(['points', function(p){ return p.id === tree.get('pointId')},'activity'],averAge(response.data));
      $('#instagramFeed').html(templates.instagramFeed( response ));
    }
    function updateStorage(){
      localStorage.setItem(storageKey,JSON.stringify(tree.serialize()))
    }
  })
}

// UTILS  //////////////////////////////////////////////////////////////////////
// load templates from dom
function getTemplates(){
  var t = [];
  $('script[type*=handlebars-template]').each(function(){
    t[$(this).attr('id')] = Handlebars.compile($(this).html());
  })
  return t;
}

// get instagram result average age
function averAge(data){
  var age = _.sum(data, function(d){ return d.created_time }) / data.length ;
  return Math.floor( Date.now()/1000 - age );
}

// filter and format geojson points
function getPoints(data){
  return _(data)
    .filter(function(p){
      // remove not numeric coordinates
      return _.isNumber(p.geometry.coordinates[1]) || _.isNumber(p.geometry.coordinates[0]);
    })
    .uniq(function(p){
      // remove to close points
      return round(p.geometry.coordinates[1], 2)+','+round(p.geometry.coordinates[0], 2);
    })
    .map(function(p , i){
      // get clean object from geojson
      return {
        id: i,
        lat: p.geometry.coordinates[1],
        lng: p.geometry.coordinates[0],
        name: p.properties.name,
        description: p.properties.description,
        activity:0
      }
    })
    .value();
}

// create new markers from point array
function getMarkers(pts, map){
 return _(pts).indexBy('id').map(function(p){
    return new google.maps.Marker({ map: map, position: p, icon: 'assets/images/wifi.png'});
  }).value()
}



var round = function(nb, prec) {return Number(Math.round(nb+'e'+prec)+'e-'+prec)}
var next = function(nb) { return nb + 1; };
var prev = function(nb) { return nb - 1; };
var negate = function(nb) { return -nb; };
var abs = function(nb) { return Math.abs(nb); };


Handlebars.registerHelper('debug', function(optionalValue) {
  console.log('Current Context');
  console.log('====================');
  console.log(this);

  if (optionalValue) {
    console.log('Value');
    console.log('====================');
    console.log(optionalValue);
  }
});

