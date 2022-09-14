var gulp        = require('gulp');
var babel       = require('gulp-babel');
var mocha       = require('gulp-mocha');
var del         = require('del');


gulp.task('clean', function () {
    return del('lib');
});

gulp.task('lint', function () {
    var eslint = require('gulp-eslint');

    return gulp
        .src([
            'src/**/*.js',
            'test/**/*.js',
            'Gulpfile.js'
        ])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.task('build', gulp.series('clean', 'lint', function () {
    return gulp
        .src('src/**/*.js')
        .pipe(babel())
        .pipe(gulp.dest('lib'));
}));

gulp.task('test', gulp.series('build', function () {
    var args = require('yargs').argv;
    var source = args.file ? args.file : 'test/**.js';
    
    return gulp
        .src(source)
        .pipe(mocha({
            ui:       'bdd',
            reporter: 'spec',
            timeout:  typeof v8debug === 'undefined' ? 2000 : Infinity // NOTE: disable timeouts in debug
        }));
}));
