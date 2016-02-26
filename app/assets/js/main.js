function initialize() {
  $.getJSON( 'data/refined.json', function(data) {

    // STATE AND TREE //////////////////////////////////////////////////////////
    var templates = getTemplates();
    var monkey = Baobab.monkey;

    var storageKey = 'NOF';
    var storageData = {}// JSON.parse(localStorage.getItem(storageKey) || '{}');
    var toCapture = [44,73,84,93,131,137,152,174,181,184,185,187,286,290,345,346,353,364,367,376,389,390,410,416,427,428,430,432,433,440,453,467,469,487,488,500,516,517,539,541,683,698,724,754];
    var curCapture = 0;

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

      slideShowInterval: 150000* 10000,
      slideShowFade: 250,

      rotateInterval: 10000,
      controls:null,
      targetMarker:{},

      autoVisitTimer:10*1000,

      pois:[44,73,84,93,131,137,152,174,181,184,185,187,286,290,345,346,353,
      364,367,376,389,390,410,416,427,428,430,432,433,440,453,467,469,487,488,
      500,516,517,539,541,683,698,724,754],
      poiId:0

    };

    var tree = new Baobab(_.defaults({},storageData,state),{lazyMonkeys:false});
    window.tree = tree;

    console.log(tree.get());

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
    tree.select('poiId').on('update', function(e){
      var pois = tree.get('pois');
      tree.set('pointId', pois[ tree.get('poiId') % pois.length]);
    });

    // INIT ////////////////////////////////////////////////////////////////////

    var pitchAnim = setInterval(pitchAnimate, tree.get('pitchInterval'));
    var rotateMapAnim = setInterval(autoRotate, tree.get('rotateInterval'));
    var instagramAnim = setInterval(instaNextFrames, tree.get('slideShowInterval'));
    var autoVisit = setInterval(function(){tree.select('poiId').apply(next)},tree.get('autoVisitTimer'));

    var searchZoneCircle = new google.maps.Circle();
    var pegmanFov = new google.maps.Polyline();
    var picMarkers = [];

    // slides an controls
    $( '#slideId' ).attr('max', tree.get('points').length );
    $( '#currentId, #slideId' ).change(function() { tree.set('pointId', parseInt( $( this ).val() ) );});
    $( '#currentDistance, #slideDistance' ).change(function() { tree.set('distance', parseInt( $( this ).val() ) );});

    // key actions
    $( 'body' ).keypress(function( event ) {

      clearInterval(autoVisit);
      autoVisit = setInterval(function(){tree.select('pointId').apply(next)}, tree.get('autoVisitTimer'));

      var k = event.which;

      // j or k next/prev point
      if (k === 106 )       tree.select('pointId').apply(nextPoint)
      else if (k === 107 )  tree.select('pointId').apply(prevPoint)

      // c show/hide controls
      else if (k === 99 )   tree.select('controls').apply(toogle)

      // r random point
      else if (k === 114 )  tree.set('pointId', _.random(0,tree.get('points').length))

      // i change instagram images
      else if (k === 105 )  instaNextFrames()

      // d or f next/prev point of interest
      else if (k === 100 )  tree.select('poiId').apply(next)
      else if (k === 102 )  tree.select('poiId').apply(next)
      else console.log( k )

    });

    var nextPoint = function(nb) { return (nb + 1) % tree.get('points').length };
    var prevPoint = function(nb) { return ((nb - 1) < 0 ? tree.get('points').length : (nb - 1)) };

    // instagram feed listenner
    $('.instagram').on('didLoadInstagram', onInstagramDidLoad);

    function instaNextFrames(){
      var imagePerLine = Math.floor($( document ).width() / 150) * 2;
      console.log(imagePerLine);
      $('#instagramFeed').fadeOut( tree.get('slideShowFade') , function(){
        if($('#instagramFeed img').length > imagePerLine){
          for (var i = imagePerLine - 1; i >= 0; i--) {
            $('#instagramFeed img:last').after($('#instagramFeed img:first'));
          };
        }
         $('#instagramFeed').fadeIn(tree.get('slideShowFade'));
      });
    }

    var layer = "toner";
    var tonerMap = new google.maps.Map(document.getElementById("tonerMap"), {mapTypeId: layer});
    tonerMap.mapTypes.set(layer, new google.maps.StamenMapType(layer));

    var map = new google.maps.Map(document.getElementById('map'), {
      streetViewControl: true, mapTypeId: google.maps.MapTypeId.SATELLITE
    });

    var panorama = new google.maps.StreetViewPanorama(document.getElementById('pano'));;
    var streetViewService = new google.maps.StreetViewService();

    // marker indexation
    var targetMarkerIndex = getMarkers(tree.get('points'), map, 'none.svg');
    var targetMarkerIndexToner = getMarkers(tree.get('points'), tonerMap, 'antenna-red.svg');

    tree.set('pointId', tree.get('points').length/2);
    tree.set('controls', false);
    distance.emit('update');

    // MAP UTILS ///////////////////////////////////////////////////////////////
    function onPointIdUpdate(e) {
      var point = tree.get('point');
      console.log(point);

      pegmanFov.setMap(null);

      streetViewService.getPanorama({location:point, radius: tree.get('distance')}, onPanorama);
      map.setCenter(point);

      $('#activity').html(templates.activity( tree.get() ));
      $('#pointInfo').html(templates.pointInfo( tree.get() ));
      $('#currentId, #slideId').val(tree.get('pointId'));

      updateInstagram();
      transition();
    }

    function onPanorama(data, status) {
      if (!_.isNull(data)) {

        clearInterval(pitchAnim);
        clearInterval(rotateMapAnim);

        var viewpointMarker = new google.maps.Marker({ map: map, position: data.location.latLng });
        var targetMarker = targetMarkerIndex[tree.get('pointId')];

        // update panorama
        tree.set('heading',google.maps.geometry.spherical.computeHeading(viewpointMarker.getPosition(), targetMarker.getPosition()))
        tree.set('pitch', tree.get('pitchCenter'))

        pitchSpeed.apply(abs);

        panorama.setPano(data.location.pano);
        panorama.setVisible(true);

        // map bounds
        var bounds = new google.maps.LatLngBounds();
        bounds.extend(viewpointMarker.getPosition());
        bounds.extend(targetMarker.getPosition());
        map.fitBounds(bounds);

        pegmanFov.setMap(null);
        pegmanFov = null;

        pegmanFov = new google.maps.Polyline({
            path: [viewpointMarker.getPosition(), targetMarker.getPosition()],
            strokeColor:  "#FF0000",
            strokeOpacity: 1.0,
            strokeWeight: 1 * map.getZoom()/10,
            map: map
        });

        rotateMapAnim = setInterval(autoRotate, tree.get('rotateInterval'));
        pitchAnim = setInterval(pitchAnimate, tree.get('pitchInterval'));

        // unset pegman
        viewpointMarker.setMap(null);

      }else{
        panorama.setVisible(false);
      }
    }

    function autoRotate() {
      if (map.getTilt() !== 0) {
        var heading = map.getHeading() || 0;
        map.setHeading(heading + 90);
      }
    }

    function updatePanoramaPov(){
      panorama.setPov({heading:tree.get('heading'), pitch: tree.get('pitch') });
      map.setStreetView(panorama);
    }

    function pitchAnimate(){
      var pitch = tree.get('pitch');
      if(pitch > tree.get('pitchMax') || pitch < tree.get('pitchMin') ) pitchSpeed.apply(negate);
      tree.set('pitch', pitch + pitchSpeed.get() );
    }

    // INSTAGRAM ///////////////////////////////////////////////////////////////
    function updateInstagram(){
      $('#instagramFeed').fadeOut(tree.get('slideShowFade'));

      $('.instagram').instagram({
        search: {
          lat: tree.get('point','lat'),
          lng: tree.get('point','lng'),
          distance: tree.get('distance')
        },clientId: 'baee48560b984845974f6b85a07bf7d9'
      });
    }

    function onInstagramDidLoad(event, response, req){

      clearInterval(instagramAnim);
      $('#instagramFeed').fadeIn(tree.get('slideShowFade'));
      instagramAnim = setInterval(instaNextFrames, tree.get('slideShowInterval'));

      // sort by distance from current point
      response.data = _.sortBy(response.data, function(d){
        var p1 = [d.location.latitude, d.location.longitude];
        var p2 = [tree.get('point','lat'), tree.get('point','lng')];
        return distanceBetweenPoints(p1,p2);
      })

      var targetMarker = targetMarkerIndex[tree.get('pointId')];
      searchZoneCircle.setMap(null);
      searchZoneCircle = new google.maps.Circle({
        strokeColor: '#FF0000',
        strokeOpacity: 1,
        strokeWeight: 2,
        fillOpacity: 0,
        map: tonerMap,
        center: targetMarker.getPosition(),
        radius: tree.get('distance')
      });

      var bounds = new google.maps.LatLngBounds();

      picMarkers.forEach(function(m){ m.setMap(null);} )

      response.data.forEach(function(d){
        var pos = { lat: d.location.latitude, lng: d.location.longitude }
        var picMarker = new google.maps.Marker({
          map: tonerMap,
          position: pos,
          icon: './assets/images/square.svg'
        });

        bounds.extend(picMarker.getPosition());
        picMarkers.push(picMarker);
      })
      tonerMap.fitBounds(bounds);

      tonerMap.setZoom(11);
      tonerMap.setCenter(tree.get('point'))

      tree.set(['points', function(p){
        return p.id === tree.get('pointId')
      },'activity'], averAge(response.data));

      $('#instagramFeed').html(templates.instagramFeed( response ));
    }

    function updateStorage(){
      localStorage.setItem(storageKey,JSON.stringify(tree.serialize()))
    }

    // TIMELINE VIZ  ///////////////////////////////////////////////////////////
    var width = $('#world').width(), height = $('#world').height(),
    svg = d3.select('#world').append('svg:svg').attr('width', width).attr('height', height);

    var projection = d3.geo.orthographic()
        .scale(width/2 - 10)
        .translate([width / 2, height / 2])
        .clipAngle(90)

    var path = d3.geo.path().projection(projection);
    var graticule = d3.geo.graticule();

    svg.append("path")
      .datum(graticule.outline)
      .attr("class", "graticule-background")
      .attr("d", path)

    var worldPath = svg.append("path");
    var pointsCircle = svg.selectAll('.pointsCircle')
        .data(tree.get('points')).enter().append('circle');

    svg.append("path")
        .datum(graticule)
        .attr("class", "graticule")
        .attr("d", path)

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
      svg.selectAll('.graticule, .land').attr('d', path);

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
function getMarkers(pts, map, icon){
 return _(pts).indexBy('id').map(function(p){

   var image = {
      url: './assets/images/'+icon,
      size: new google.maps.Size(32, 32),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(16,2)
    };

    return new google.maps.Marker({ map: map, position: p, icon: image});
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

initialize();

