'use strict';

function initialize() {
  $.getJSON( 'data/refined.json', function(data) {

    // STATE AND TREE //////////////////////////////////////////////////////////
    var templates = getTemplates();
    var monkey = Baobab.monkey;

    var storageKey = 'NOF';
    var storageData = {}// JSON.parse(localStorage.getItem(storageKey) || '{}');

    var state = {
      points:getPoints(data.features),
      pointId:0,
      point: Baobab.monkey(['pointId'],['points'], function(id, points) {
        return points[id] || null;
      }),
      distance: 3000,
      heading: 50,

      pitch: 50,
      pitchSpeed: 0.05,
      pitchInterval: 100,
      pitchMax: 40,
      pitchMin: -20,
      pitchCenter:monkey({ cursors: { max: ['pitchMax'], min: ['pitchMin']},
        get: function(data) { return (data.max + data.min)/2 }
      }),

      controls:null,
      targetMarker:{}
    };

    var tree = new Baobab(_.defaults({},storageData,state),{lazyMonkeys:false});
    window.tree = tree;

    console.log(storageData, tree.get());

    var points = tree.select('points')
        points.on('update', updateStorage);



    var pointId = tree.select('pointId');
        pointId.on('update', onPointIdUpdate)

    var distance = tree.select('distance');
        distance.on('update', function(e){
          updateInstagram();
          $('#currentDistance, #slideDistance').val(distance.get());
        })

    var pitchSpeed = tree.select('pitchSpeed');
    tree.select('pitch').on('update', updatePanoramaPov);
    tree.select('heading').on('update', updatePanoramaPov);
    tree.select('controls').on('update', function(e){
        tree.get('controls') ? $("#controls").show() : $("#controls").hide()
     });


    //

    function onPointIdUpdate(e) {
      var point = tree.get('point');
      console.log(point);

      sv.getPanorama({location:point, radius: tree.get('distance')}, processSVData);
      map.setCenter(point);

      $('#activity').html(templates.activity( tree.get() ));
      $('#pointInfo').html(templates.pointInfo( tree.get() ));
      $('#currentId, #slideId').val(tree.get('pointId'));

      updateInstagram()
      transition()
    }

    // INIT ////////////////////////////////////////////////////////////////////

    var pitchAnim = setInterval(pitchAnimate, tree.get('pitchInterval'));

    // slides an controls
    $( '#slideId' ).attr('max', tree.get('points').length );
    $( '#currentId, #slideId' ).change(function() { tree.set('pointId', parseInt( $( this ).val() ) );});
    $( '#currentDistance, #slideDistance' ).change(function() { tree.set('distance', parseInt( $( this ).val() ) );});

    // key actions
    $( 'body' ).keypress(function( event ) {
      if ( event.which == 106 ) { tree.select('pointId').apply(next);}
      else if ( event.which == 107 ) { tree.select('pointId').apply(prev);}
      else if ( event.which == 99 ) { tree.select('controls').apply(toogle);}
    });

    // instagram feed listenner
    $('.instagram').on('didLoadInstagram', onInstagramDidLoad);

    var loop = setInterval(nextFrame, 10000);

    function nextFrame(){
      if($('#instagramFeed img').length > 6){
        for (var i = 6 - 1; i >= 0; i--) {
          $('#instagramFeed img:last').after($('#instagramFeed img:first'));
        };
      }
    }

    // maps and panorama objects

    // var mapOptions = {};
    // var tonerMap = L.map('tonerMap', mapOptions).setView([51.505, -0.09], 17);

    // var layerOptions = {
    //   attribution : 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    //   tilePath : 'http://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}.png',
    //   minZoom:1,
    // }

    // L.tileLayer(layerOptions.tilePath, layerOptions).addTo(tonerMap);


    var tonerMap = new google.maps.Map(document.getElementById('tonerMap'), {
      center: tree.get('points')[0],
      zoom: 10, streetViewControl: true, mapTypeId: google.maps.MapTypeId.TERRAIN
    });

    // var moonMapType = new google.maps.ImageMapType({
    //       "getTileUrl": function(coord, zoom) {

    //           var subdomains ="a b c d".split(" ");
    //           var server = "http://stamen-tiles-{S}.tile.stamen.com/toner/{Z}/{X}/{Y}..png";

    //           var numTiles = 1 << zoom,
    //               wx = coord.x % numTiles,
    //               x = (wx < 0) ? wx + numTiles : wx,
    //               y = coord.y,
    //               index = (zoom + x + y) % subdomains.length;
    //           return server
    //               .replace("{S}", subdomains[index])
    //               .replace("{Z}", zoom)
    //               .replace("{X}", x)
    //               .replace("{Y}", y);
    //       },
    //       "tileSize": new google.maps.Size(256, 256),
    //       "name":     'moon',
    //       "minZoom":  0,
    //       "maxZoom":  17
    // });

    // tonerMap.mapTypes.set('moon', moonMapType);


    var map = new google.maps.Map(document.getElementById('map'), {
      center: tree.get('points')[0],
      zoom: 17, streetViewControl: true, mapTypeId: google.maps.MapTypeId.SATELLITE
    });

    var panorama = new google.maps.StreetViewPanorama(document.getElementById('pano'));;
    var sv = new google.maps.StreetViewService();

    // marker indexation
    var targetMarkerIndex = getMarkers(tree.get('points'), map);

    tree.set('pointId', tree.get('points').length/2);
    tree.set('controls', false);
    distance.emit('update');

    // MAP UTILS ///////////////////////////////////////////////////////////////


    function autoRotate() {
      if (map.getTilt() !== 0) {
        var heading = map.getHeading() || 0;
        map.setHeading(heading + 90);
      }
    }

    setInterval(autoRotate, 7000);


    function updatePanoramaPov(){
      panorama.setPov({heading:tree.get('heading'), pitch: tree.get('pitch') });
      map.setStreetView(panorama);
      tonerMap.setStreetView(panorama);

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
        tonerMap.fitBounds(bounds);


        var line = new google.maps.Polyline({
            path: [viewpointMarker.getPosition(), targetMarker.getPosition()],
            strokeColor: "#FF0000",
            strokeOpacity: 1.0,
            strokeWeight: 1 * map.getZoom()/10 ,
            map: map
        });

        // map.setZoom(map.getZoom() - 1);

        pitchAnim = setInterval(pitchAnimate,tree.get('pitchInterval'));

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
        var p1 = [d.location.latitude, d.location.longitude];
        var p2 = [tree.get('point','lat'), tree.get('point','lng')];
        return distanceBetweenPoints(p1,p2);
      })

      tree.set(['points', function(p){
        return p.id === tree.get('pointId')
      },'activity'], averAge(response.data));

      $('#instagramFeed').html(templates.instagramFeed( response ));
    }

    function updateStorage(){
      console.log('updateStorage')
      localStorage.setItem(storageKey,JSON.stringify(tree.serialize()))
    }


    // TIMELINE VIZ


    var width = $('#world').width(), height = $('#world').height(),
    svg = d3.select('#world').append('svg:svg').attr('width', width).attr('height', height);

    var projection = d3.geo.orthographic()
        .scale(width/2.5)
        .translate([width / 2, height / 2])
        .clipAngle(90)
        // .precision(0.5)

    var path = d3.geo.path().projection(projection);
    var worldPath = svg.append("path");
    var pointsCircle = svg.selectAll('.pointsCircle')
        .data(tree.get('points')).enter().append('circle');

    var graticule = d3.geo.graticule();

    svg.append("path")
        .datum(graticule)
        .attr("class", "graticule")
        .attr("d", path);

    function transition() {
      d3.transition()
          .duration(1250)
          .tween("rotate", function() {
            var p = [tree.get('point').lng, tree.get('point').lat],
                r = d3.interpolate(projection.rotate(), [-p[0], -p[1]]);

            return function(t) {
              projection.rotate(r(t));
              refreshPosition();
            };
          })
    }

    function refreshPosition(){
      svg.selectAll("path").attr("d", path);
      pointsCircle
        .attr('cx', function(d){ return projection([d.lng,d.lat])[0]})
        .attr('cy', function(d){ return projection([d.lng,d.lat])[1]})
        .transition()
        .attr('r', function(d){ return d.id === tree.get('pointId') ? 10 : 1  })
    }

    d3.json("assets/images/world-110m.json", function(error, world) {
      if (error) throw error;

      worldPath
          .datum(topojson.feature(world, world.objects.land))
          .attr("class", "land")
          .attr("d", path)
          .style('fill','white')
          ;

      pointsCircle.attr('r', 2).style('fill', 'red');

    });
  }) // load
} // end initialize

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
    .sortBy(function(p){
      return p.geometry.coordinates[0]
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
    .value()
}

function distanceBetweenPoints(p1, p2) {
  return Math.abs(Math.sqrt((p1[0] - p2[0]) * (p1[0] - p2[0]) + (p1[1] - p2[1]) * (p1[1] - p2[1])));
}


// create new markers from point array
function getMarkers(pts, map){
 return _(pts).indexBy('id').map(function(p){
    return new google.maps.Marker({ map: map, position: p, icon: './assets/images/none.svg'});
  }).value()
}

var round = function(nb, prec) {return Number(Math.round(nb+'e'+prec)+'e-'+prec)}
var next = function(nb) { return nb + 1; };
var prev = function(nb) { return nb - 1; };
var negate = function(nb) { return -nb; };
var abs = function(nb) { return Math.abs(nb); };
var toogle = function(boolean) { return !boolean; };

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

