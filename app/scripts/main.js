function initialize() {
  $.getJSON( "data/data.json", function(data) {
    $( ".splash" ).removeClass('hide');

    var points = _(data.features)
      .filter(function(p){
        return  _.isNumber(p.geometry.coordinates[1]) || _.isNumber(p.geometry.coordinates[0]);
      })
      .sortBy(function(d){return d.properties.name;})
      .map(function(p){
        return {
          lat: p.geometry.coordinates[1],
          lng: p.geometry.coordinates[0],
          "name": p.properties.name,
          "description": p.properties.description
        }
      }).value();
    var curPoint, curPointId = _.random(0,points.length), dir = 1, curViewPointMarker;

    console.log("points:", points.length,points);

    // create google maps objects
    var map = new google.maps.Map(document.getElementById('map'), {
      center: points[0],
      zoom: 17,
      streetViewControl: true,
      mapTypeId: google.maps.MapTypeId.SATELLITE
    });

    var panorama = new google.maps.StreetViewPanorama(document.getElementById('pano'));;
    var sv = new google.maps.StreetViewService();

    // user events

    $( ".splash" ).on( "click", clearSplash);
    $( ".description").hover(function(){
      $( this ).removeClass("short");
    },function(){
      $( this ).addClass("short");
    });

    function clearSplash(){
      $( ".splash" ).addClass('hide');
    }


    $( "body" ).keypress(function( event ) {

      clearSplash();

      if ( event.which == 106 ) {
        dir = 1;
        nextPoint();
      }
      if ( event.which == 107 ) {
        dir = -1;
        nextPoint();
      }
      if ( event.which == 115 ) {
        var url = 'http://maps.google.com/maps?q=&layer=c&cbll='
        +curViewPointMarker.getPosition().lat()+','+curViewPointMarker.getPosition().lng();
        var win = window.open(url, '_blank');
        win.focus();
      }
      // if ( )

    });

    // go to first point
    nextPoint();

    // functions
    function nextPoint(){

      curPointId += dir;

      curPoint = points[curPointId%points.length];
      sv.getPanorama({location:curPoint, radius: 500}, processSVData);
      map.setCenter(curPoint);

      console.log(curPointId, curPoint);
    }
    function processSVData(data, status) {

      if (_.isNull(data)) {
        nextPoint();
      }else{

        var viewpointMarker = new google.maps.Marker({
          map: map,
          position: data.location.latLng
        });

        curViewPointMarker = viewpointMarker;

        var targetMarker = new google.maps.Marker({
          map: map,
          position: curPoint,
          icon: 'https://google-developers.appspot.com/maps/documentation/javascript/examples/full/images/beachflag.png'
        });

        var heading = google.maps.geometry.spherical.computeHeading(viewpointMarker.getPosition(), targetMarker.getPosition());

        panorama.setPano(data.location.pano);
        panorama.setPov({heading:heading, pitch: 5});

        panorama.setVisible(true);
        map.setStreetView(panorama);

        var bounds = new google.maps.LatLngBounds();
        bounds.extend(viewpointMarker.getPosition());
        bounds.extend(targetMarker.getPosition());
        map.fitBounds(bounds);

        // unset pegman marker
        viewpointMarker.setMap(null);

        // change description
        $(".description").html(curPoint.description  +'<br> lat:'+ curPoint.lat + 'lng' + curPoint.lng);
        $(".name").text(curPointId+'/'+points.length+' — ' + curPoint.name );


        if (status !== google.maps.StreetViewStatus.OK) {
          console.error('Street View data not found for this location.');
        }
      }
    }
  })
}

function loadScript(src,callback){
  var script = document.createElement("script");
  script.type = "text/javascript";
  if(callback)script.onload=callback;
  document.getElementsByTagName("head")[0].appendChild(script);
  script.src = src;
}

loadScript('http://maps.googleapis.com/maps/api/js?v=3&sensor=false&callback=initialize',
              function(){console.log('google-loader has been loaded, but not the maps-API ');});
