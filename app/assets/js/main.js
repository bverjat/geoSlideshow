loadScript('http://maps.googleapis.com/maps/api/js?v=3&sensor=false&callback=initialize');

function initialize() {
  $.getJSON( 'data/data-tweets-save.json', function(data) {


    // STATE AND TREE
    var tree = new Baobab({

      points:getPoints(data.features),
      pointId:0,
      point: Baobab.monkey(['pointId'],['points'], function(id, points) {
        return points[id % points.length] || null;
      }),
      distance: 2000,
      heading: 50,
      pitch: 50,
      targetMarker:{}

    },{lazyMonkeys:false});

    window.tree = tree;

    var i =0;
    setInterval(function(){ tree.select('pitch').apply(pitchTilt); },50)

    function updatePanoramaPov(){
      panorama.setPov({heading:tree.get('heading'), pitch: tree.get('pitch') });
      map.setStreetView(panorama);
    }

    function pitchTilt(pitch){
      var dir = (pitch > 70) ? -1 : 1;
      return pitch + (dir*0.05)
    }

    var point = tree.select('point');
        point.on('update', function(e){

          var point = e.data.currentData;
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
          $("#currentDistance, #slideDistance").val(e.data.currentData);
        })

    tree.select('pitch').on('update', updatePanoramaPov);
    tree.select('heading').on('update', updatePanoramaPov);

    var templates = getTemplates();

    // INIT
    tree.set('pointId',_.random(0,tree.get('points').length))
    tree.set('distance', 1000);

    $( '#slideId' ).attr('max', tree.get('points').length );

    $( "#currentId, #slideId" ).change(function() { tree.set('pointId', parseInt( $( this ).val() ) );});
    $( "#currentDistance, #slideDistance" ).change(function() { tree.set('distance', parseInt( $( this ).val() ) );});

    // create google maps objects
    var map = new google.maps.Map(document.getElementById('map'), {
      center: tree.get('points')[0],
      zoom: 17, streetViewControl: true, mapTypeId: google.maps.MapTypeId.SATELLITE
    });

    var targetMarkerIndex = getMarkers(tree.get('points'), map);
    var panorama = new google.maps.StreetViewPanorama(document.getElementById('pano'));;
    var sv = new google.maps.StreetViewService();

    function processSVData(data, status) {

      if (!_.isNull(data)) {

        var viewpointMarker = new google.maps.Marker({ map: map, position: data.location.latLng });
        var targetMarker = targetMarkerIndex[point.get('id')];
        viewpointMarker.setMap(null);

        // panorama
        tree.set('heading',google.maps.geometry.spherical.computeHeading(viewpointMarker.getPosition(), targetMarker.getPosition()))

        panorama.setPano(data.location.pano);
        panorama.setVisible(true);
        // map.setStreetView(panorama);
        tree.set('pitch',-20)


        // map bounds
        var bounds = new google.maps.LatLngBounds();
        bounds.extend(viewpointMarker.getPosition());
        bounds.extend(targetMarker.getPosition());
        // map.fitBounds(bounds);
        map.panToBounds(bounds);
        // unset pegman marker
      }else{
        tree.set('pitch',90)
      }
    }
    // instagram
    function updateInstagram(){
      $('.instagram').instagram({
        search: { lat: tree.get('point','lat'), lng: tree.get('point','lng'), distance: tree.get('distance')},
        clientId: 'baee48560b984845974f6b85a07bf7d9'
      });
    }

    function onInstagramDidLoad(event, response){
      console.log(response.data)

      // sort by distance from current point
      response.data = _.sortBy(response.data, function(d){
        var x1 = d.location.latitude;
        var y1 = d.location.longitude;
        var x2 = tree.get('point','lat');
        var y2 = tree.get('point','lng');;
        return d = Math.sqrt( (x1-x2)*(x1-x2) + (y1-y2)*(y1-y2) );
      })

      // if(response.data.length < 14) tree.select('distance').apply(function(distance){console.log(distance); return distance - 500 })
      $('#instagramFeed').html(templates.instagramFeed( response ));
    }

    $('.instagram').on('didLoadInstagram', onInstagramDidLoad);
  })
}

// user events
$( 'body' ).keypress(function( event ) {
    console.log(event.which)
  if ( event.which == 106 ) { tree.select('pointId').apply(next);}
  if ( event.which == 107 ) { tree.select('pointId').apply(prev);}
  if ( event.which == 115 ) {
    var url = 'http://maps.google.com/maps?q=&layer=c&cbll='
    +curViewPointMarker.getPosition().lat()+','+curViewPointMarker.getPosition().lng();
    var win = window.open(url, '_blank');
    win.focus();
  }
});

function getTemplates(){
  var t = [];
  $('script[type*=handlebars-template]').each(function(){
    t[$(this).attr('id')] = Handlebars.compile($(this).html());
  })
  return t;
}

function getPoints(data){

  return _(data)
    .filter(function(p){
      // remove not numeric coordinates
      return  _.isNumber(p.geometry.coordinates[1]) || _.isNumber(p.geometry.coordinates[0]);
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
        statuses: _.get(p,'res.statuses', []),
        hashtags:getHashTags(_.get(p,'res.statuses', []))
      }
    })
    // .sortBy(function(d){return -d.statuses.length;})
    .value();
}

function round(value, decimals) {
    return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
}

function getHashTags(statuses){

  var hashtags = [];

  statuses.forEach(function(s){
    _.get(s, ['entities','hashtags']).forEach(function(h){
      hashtags.push('#'+h.text)
    })
  })

  return _.uniq(hashtags)
}

function getMarkers(pts, map){
   return _(pts).indexBy('id').map(function(p){
      return new google.maps.Marker({
        map: map,
        position: p,
        icon: 'assets/images/wifi.png'
      });
    }).value()
}

var next = function(nb) { return nb + 1; };
var prev = function(nb) { return nb - 1; };

function loadScript(src,callback){
  var script = document.createElement('script');
  script.type = 'text/javascript';
  if(callback)script.onload=callback;
  document.getElementsByTagName('head')[0].appendChild(script);
  script.src = src;
}

Handlebars.registerHelper("debug", function(optionalValue) {
  console.log("Current Context");
  console.log("====================");
  console.log(this);

  if (optionalValue) {
    console.log("Value");
    console.log("====================");
    console.log(optionalValue);
  }
});

