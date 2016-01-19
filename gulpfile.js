var gulp = require('gulp'),
    less = require('gulp-less'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    handlebars = require('gulp-handlebars'),
    browserSync = require('browser-sync').create();

var jsFiles = [
  './bower_components/jquery/dist/jquery.js',
  './bower_components/lodash/lodash.js',
  './bower_components/handlebars/handlebars.min.js',
  './bower_components/baobab/build/baobab.js'
  ];

gulp.task('less', function() {
    return gulp.src('./app/assets/less/*.less')
      .pipe(less())
      .pipe(gulp.dest('./app/assets/css'))
      .pipe(browserSync.stream());
});

// javascript compilation
gulp.task('build', function() {
  return gulp.src(jsFiles,{base: 'bower_components/'})
    .pipe(concat('lib.min.js'))
    // .pipe(uglify())
    .pipe(gulp.dest('./app/assets/js/'));
});

gulp.task('serve', ['less'], function() {
    browserSync.init({server: "./app"});
    gulp.watch('./app/assets/less/*.less', ['less']);
    gulp.watch("app/*.html").on('change', browserSync.reload);
    gulp.watch("app/assets/js/*.js").on('change', browserSync.reload);
});

gulp.task('default', [ 'less', 'fonts', 'build']);
