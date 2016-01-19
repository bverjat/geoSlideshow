loadScript('http://maps.googleapis.com/maps/api/js?v=3&sensor=false&callback=initialize');

function initialize() {
  $.getJSON( 'data/data-tweets.json', function(data) {
    // $( '.splash' ).removeClass('hide');


    var tree = new Baobab({

      points:getPoints(data.features),
      pointId:0,
      point: Baobab.monkey(['pointId'],['points'], function(id, points) {
        return points[id % points.length] || null;
      }),

      targetMarker:{}

    });
    window.tree = tree;

    var point = tree.select('point');
        point.on('update', function(e){
          var point = e.data.currentData;
          sv.getPanorama({location:point, radius: 500}, processSVData);
          map.setCenter(point);

          console.log(point);

          $('#activity').html(templates.activity( tree.get() ));
          $('#pointInfo').html(templates.pointInfo( tree.get() ));
          $('#currentId').val(tree.get('pointId'));

        })

    var templates = getTemplates();

    // create google maps objects
    var map = new google.maps.Map(document.getElementById('map'), {
      center: tree.get('points')[0],
      zoom: 17,
      streetViewControl: true,
      mapTypeId: google.maps.MapTypeId.SATELLITE
    });

    var panorama = new google.maps.StreetViewPanorama(document.getElementById('pano'));;
    var sv = new google.maps.StreetViewService();

    function processSVData(data, status) {

      if (_.isNull(data)) {
        tree.select('pointId').apply(next);
      }else{

        var viewpointMarker = new google.maps.Marker({ map: map, position: data.location.latLng });
        var targetMarker = new google.maps.Marker({
          map: map,
          position: point.get(),
          icon: 'https://google-developers.appspot.com/maps/documentation/javascript/examples/full/images/beachflag.png'
        });

        // panorama
        var heading = google.maps.geometry.spherical.computeHeading(viewpointMarker.getPosition(), targetMarker.getPosition());
        panorama.setPano(data.location.pano);
        panorama.setPov({heading:heading, pitch: 5});
        panorama.setVisible(true);
        map.setStreetView(panorama);

        // map bounds
        var bounds = new google.maps.LatLngBounds();
        bounds.extend(viewpointMarker.getPosition());
        bounds.extend(targetMarker.getPosition());
        map.fitBounds(bounds);

        // unset pegman marker
        viewpointMarker.setMap(null);
        if (status !== google.maps.StreetViewStatus.OK) console.error('Street View data not found for this location.');
      }
    }
  })
}



// user events
$( '.splash' ).on( 'click', clearSplash);
$( '.description').hover(
  function(){$(this).removeClass('short');},
  function(){$(this).addClass('short');}
);

$( "#currentId" ).change(function() {
  tree.set('pointId', parseInt( $( this ).val() ) );
});

$( 'body' ).keypress(function( event ) {

  clearSplash();

  if ( event.which == 106 ) { tree.select('pointId').apply(next);}
  if ( event.which == 107 ) { tree.select('pointId').apply(prev);}
  if ( event.which == 115 ) {
    var url = 'http://maps.google.com/maps?q=&layer=c&cbll='
    +curViewPointMarker.getPosition().lat()+','+curViewPointMarker.getPosition().lng();
    var win = window.open(url, '_blank');
    win.focus();
  }
});

function clearSplash(){ $( '.splash' ).addClass('hide'); }

function loadScript(src,callback){
  var script = document.createElement('script');
  script.type = 'text/javascript';
  if(callback)script.onload=callback;
  document.getElementsByTagName('head')[0].appendChild(script);
  script.src = src;
}

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
      return  _.isNumber(p.geometry.coordinates[1]) || _.isNumber(p.geometry.coordinates[0]);
    })
    .sortBy(function(d){return d.properties.name;})
    .map(function(p){
      return {
        lat: p.geometry.coordinates[1],
        lng: p.geometry.coordinates[0],
        name: p.properties.name,
        description: p.properties.description,
        statuses: _.get(p,'res.statuses', [])
      }
    }).value();
}

var next = function(nb) { return nb + 1; };
var prev = function(nb) { return nb - 1; };


