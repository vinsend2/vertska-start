"use strict";

// Переменные для галпа. Каждая переменная – отдельный плагин из package.json
var gulp = require("gulp");
var sass = require("gulp-sass");
var plumber = require("gulp-plumber");
var postcss = require("gulp-postcss");
var autoprefixer = require("autoprefixer");
var csso = require("gulp-csso");
var rename = require("gulp-rename");
var imagemin = require("gulp-imagemin");
var webp = require("gulp-webp");
var svgstore = require("gulp-svgstore");
var posthtml = require("gulp-posthtml");
var include = require("posthtml-include");
var del = require("del");
var server = require("browser-sync").create();
var uglify = require("gulp-uglify");
var babel = require('gulp-babel');
var concat = require("gulp-concat");
var sourcemaps = require('gulp-sourcemaps');
var webpack = require('webpack');
var webpackStream = require('webpack-stream');
var webpackConfig = require('./webpack.config.js');

sass.compiler = require('node-sass');

var sass_paths = [
  'source/sass/**/*.scss',
  'source/sass/**/*.sass'
];

// Таск css.
gulp.task("css", function () {
  return gulp.src("source/sass/style.scss") // Берет на вход основной файл scss, где происходят импорты
    .pipe(sourcemaps.init()) // Иницициализируем плагин для генерации source map. Если не знаешь зачем они, напиши
      .pipe(plumber()) // Плагин для отслеживания ошибок
      .pipe(sass()) // Переводим из sass в css
      .pipe(postcss([ // Применяем пост процессор PostCSS. Расставляем префиксы для других браузеров.
        autoprefixer()
      ]))
      .pipe(gulp.dest("build/css")) // Скадываем полученный css в папку build
      .pipe(csso()) // Минифицируем css. Убираем лишние пробелы и т.д.
      .pipe(rename("style.min.css")) // Переименовываем минифицированную версию в style.min.css
    .pipe(sourcemaps.write()) // Добавляем source map
    .pipe(gulp.dest("build/css")) // Ложим ее рядом с простым css. В итоге 2 файла: style.css и style.min.css
    .pipe(server.stream()); // Вызываем отслеживание browser sync
});

// Таск для картинок
gulp.task("images", function () {
  return gulp.src("source/img/**/*.{png,jpg,svg}") // Берем все картинки из source/img
    .pipe(imagemin([
      imagemin.optipng({optimizationLevel: 5}), // Применяем сжатие картинок
      imagemin.jpegtran({progressive: true}), // JPEG делаем прогрессивными, т.е. они теперь загружаются постепенно и видны сразу
      imagemin.svgo() // Минифицируем svg
    ]))
    .pipe(gulp.dest("source/img")); // Складываем в папку
});

// Таск для генерации webp
gulp.task("webp", function () {
  return gulp.src("source/img/**/*.{png,jpg}") // Берем все jpeg и png из source/img
    .pipe(webp({quality: 90})) // Выставляем качество 90, чтобы не было артефактов
    .pipe(gulp.dest("source/img")) // Складываем в папку
});

// Таск для генерации svg спрайта
gulp.task("sprite", function () {
  return gulp.src("source/img/**/*.svg") // Берем все svg из source/img
    .pipe(svgstore({
      inlineSvg: true // Делаем спрайт вида <svg><symbol>....</symbol></svg>
    }))
    .pipe(rename("sprite.svg")) // Переименовываем в sprite.svg
    .pipe(gulp.dest("build/img")); // Складываем в папку build/img
});

// Таск для встраивания спрайта в  html
gulp.task("html", function () {
  return gulp.src("source/*.html") // Берем все странички
    .pipe(posthtml([
      include() // Вставляем svg спрайт в страничку
    ]))
    .pipe(gulp.dest("build")); // Складываем в build/
});

// Таск для сбора скриптов
gulp.task("scripts", function() {
  return gulp.src("source/js/*.js") // Берем все скрипты из src/js
    .pipe(sourcemaps.init())
      .pipe(concat("script.js")) // Склеиваем их в один scripts.js
      .pipe(gulp.dest("build/js")) // Складываем build/js
      .pipe(rename("script.min.js")) // Переименовываем в scripts.min.js
      // .pipe(webpackStream(webpackConfig, webpack))
      // .pipe(uglify()) // Минифицируем
    .pipe(sourcemaps.write())
    .pipe(gulp.dest("build/js")); //Скдываем в build/js
});


gulp.task('webpack', function () {
  return gulp.src('build/js/script.min.js')
    .pipe(webpackStream({
      mode: 'production',
      output: {
        filename: 'script.min.js',
      },
      module: {
        rules: [
          {
            test: /\.(js)$/,
            exclude: /(node_modules)/,
            loader: 'babel-loader',
            query: {
              presets:  [
                ["@babel/preset-env", {
                  "useBuiltIns": "usage",
                  "corejs": 2, // or 2,
                  "targets": {
                      "firefox": "64", // or whatever target to choose .
                  },
                }]
              ]
            }
          }
        ]
      },
      externals: {
        jquery: 'jQuery'
      }
    }))
    .pipe(gulp.dest('build/js'));
});



// Таск для очистки папки
gulp.task("clean", function () {
  return del("build"); // Удаляем папку build
});

// Таск для переноса всех статичных файлов
gulp.task("copy", function () {
  return gulp.src([
    "source/fonts/**/*.{woff,woff2}", // Переносим шрифты
    "source/img/**", // Переносим картинки
    "source/js/**", // Переносим js
    "source/*.{png,xml,ico,webmanifest,svg,php}" // Переносим фавиконки
  ], {
    base: "source"
  })
  .pipe(gulp.dest("build")); // Складываем в build/
});

// Таск для сборки
gulp.task("build", gulp.series(
  "clean",
  "copy",
  "css",
  "scripts",
  "webpack",
  "sprite",
  "html"
  ));

// Таск для отслеживания изменений. Browser Sync
gulp.task("server", function () {
  server.init({ // Инициализурем с конфигом
    server: "build/",
    notify: false,
    open: true,
    cors: true,
    ui: false
  });
  // Смотрит за файлами и перезагружает, если есть изменение
  gulp.watch("source/sass/**/*.scss", gulp.series("css", "refresh"));
  gulp.watch("source/img/**/*.svg", gulp.series("sprite", "html", "refresh"));
  gulp.watch("source/*.html", gulp.series("html", "refresh"));
  gulp.watch("source/js/*.js", gulp.series("scripts", "refresh"));
});

// Перезагрузка отслеживания
gulp.task("refresh", function(done) {
  server.reload();
  done();
});

// npm start запустит автоматически слежение и сборку. т.е. вводишь npm start и работаешь, не загядывая больше в консоль, все будут делать за тебя :)
gulp.task("start", gulp.series("build", "server"));



gulp.task('sass', function () {
  return gulp.src(sass_paths)

    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('source/css'));
});



gulp.task('watch', function() {
  gulp.watch('source/sass/**/*.scss', gulp.parallel('sass'));
  gulp.watch('source/sass/**/*.sass', gulp.parallel('sass'));
});
