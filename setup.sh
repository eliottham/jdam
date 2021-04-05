# react
printf "npm: installing react core packages\n"
npm --no-audit install react react-dom

# material-ui
printf "npm: installing material-ui\n"
npm --no-audit install @material-ui/core@next @material-ui/icons@next @emotion/react @emotion/styled

# typescript
printf "npm: installing typescript core packages\n"
npm --no-audit install --save-dev typescript 
npm --no-audit install --save-dev @types/react @types/react-dom

printf "file: writing ./tsconfig.json\n"
cat <<EOF > ./tsconfig.json
{
  "compilerOptions": {
    "target": "es6",
    "lib": [
      "dom",
      "dom.iterable",
      "esnext"
    ],
    "allowJs": true,
    "skipLibCheck": true,
    "declaration": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "allowUmdGlobalAccess": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react",
    "baseUrl": "src"
  },
  "include": [ "./src/**/*" ],
  "exclude": [ "node_modules" ]
}
EOF

# Notes about tsconfig.json
#   lib: The standard typing to be included in the type checking process. In our case, we have chosen to use the types for the browsers DOM as well as the latest version of ECMAScript.
#   allowJs: Whether to allow JavaScript files to be compiled.
#   allowSyntheticDefaultImports: This allows default imports from modules with no default export in the type checking process.
#   skipLibCheck: Whether to skip type checking of all the type declaration files (*.d.ts).
#   esModuleInterop: This enables compatibility with Babel.
#   strict: This sets the level of type checking to very high. When this is true, the project is said to be running in strict mode.
#   forceConsistentCasingInFileNames: Ensures that the casing of referenced file names is consistent during the type checking process.
#   moduleResolution: How module dependencies get resolved, which is node for our project.
#   resolveJsonModule: This allows modules to be in .json files which are useful for configuration files.
#   noEmit: Whether to suppress TypeScript generating code during the compilation process. This is true in our project because Babel will be generating the JavaScript code.
#   jsx: Whether to support JSX in .tsx files.
#   include: These are the files and folders for TypeScript to check. In our project, we have specified all the files in the src folder.

printf "file: setting up project directories\n"
mkdir -p src
mkdir -p src/client
mkdir -p public

printf "file: writing public/index.html\n"
cat <<EOF > ./public/index.html
<html>
  <head>
    <meta charset="utf-8" />
    <title>Title</title>
  </head>
  <body>
    <div id="root"></div>
    <script src="main.js"></script>
  </body>
</html>
EOF

# set up basic index and app files
printf "file: writing src/index.css\n"
cat <<EOF > ./src/index.css
@import url('https://fonts.googleapis.com/css?family=Lato:300');

:root {
  --slt-grey: rgb(240, 240, 240);
  --lt-grey-s: 200, 200, 200;
  --lt-grey: rgb(var(--lt-grey-s));
  --grey-s: 150, 150, 150;
  --grey: rgb(var(--grey-s));
  --d-grey-s: 35, 40, 45;
  --d-grey: rgb(var(--d-grey-s));
  --lt-blue-s: 75, 136, 234;
  --lt-blue: rgb(var(--lt-blue-s));
  --d-blue: rgb(27, 69, 137);
  --lt-yellow-s: 236, 189, 7;
  --lt-yellow: rgb(var(--lt-yellow-s));
  --d-yellow: rgb(137, 116, 24);
  --lt-green-s: 114, 216, 67;
  --lt-green: rgb(var(--lt-green-s));
  --d-green: rgb(23, 109, 27);
  --red-s: 229, 44, 27;
  --red: rgb(var(--red-s));
  --d-red-s: 195, 35, 20;
  --d-red: rgb(var(--d-red-s));
  --green-s: 50, 130, 35;
  --green: rgb(var(--green-s));
  --gold-s: 173, 162, 36;
  --gold: rgb(var(--gold-s));
  --purp-s: 105, 56, 140;
  --purp: rgb(var(--purp-s));
  --plum-s: 140, 56, 137;
  --plum: rgb(var(--plum-s));
  --teal-s: 0, 128, 98;
  --teal: rgb(var(--teal-s));
  --turq-s: 8, 200, 181;
  --turq: rgb(var(--turq-s));
  --d-turq-s: 8, 170, 155;
  --d-turq: rgb(var(--d-turq-s));
  --white-s: 255, 255, 255;
  --white: rgb(var(--white-s));
  --black-s: 0, 0, 0;
  --black: rgb(var(--black-s));
  --orange-s: 217, 125, 50;
  --orange: rgb(var(--orange-s));
  --ease-out: cubic-bezier(0.17, 0.57, 0.43, 1);
  --primary: var(--turq);
  --d-primary: var(--d-turq);
  font-family: 'Lato', sans-serif;
}

* {
  user-select: none;
  -webkit-user-select: none;
  box-sizing: border-box;
}

*:focus {
  outline: none;
}

body, html {
  background-color: var(--white);
  /* font-family: "SF Pro Text","SF Pro Icons","Helvetica Neue","Helvetica","Arial",sans-serif;  font-size: 10pt; */
  position: relative;
  height: 100%;
  width: 100%;
  padding: 0;
  margin: 0;
  overflow: hidden;
}

.frame-absolute {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}

.frame-full {
  height: 100%;
  width: 100%;
  position: relative;
}

.flex-center {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

#root {
  height: 100%;
}

::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1; 
}
 
::-webkit-scrollbar-thumb {
  background: var(--primary); 
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--d-primary); 
}

textarea {
  font-family: inherit;
  font-size: inherit;
}
EOF

printf "file: writing src/index.tsx\n"
cat <<EOF > ./src/index.tsx
import './index.css'
import ReactDOM from 'react-dom'
import App from './app'

ReactDOM.render(
  <App />,
  document.getElementById('root')
)
EOF

printf "file: writing src/app.tsx\n"
cat <<EOF > ./src/app.tsx
function App(): JSX.Element {

  return (
    <div>App Placeholder</div>
  )
}

export default App
EOF

# install babel
#   @babel/core: As the name suggests, this is the core Babel library.
#   @babel/preset-env: This is a collection of plugins that allow us to use the latest JavaScript features but still target browsers that don’t support them.
#   @babel/preset-react: This is a collection of plugins that enable Babel to transform React code into JavaScript.
#   @babel/preset-typescript: This is a plugin that enables Babel to transform TypeScript code into JavaScript.
#   @babel/plugin-transform-runtime and @babel/runtime: These are plugins that allow us to use the async and await JavaScript features.

printf "npm: installing babel packages\n"
npm --no-audit install --save-dev @babel/core @babel/preset-env @babel/preset-react @babel/preset-typescript @babel/plugin-transform-runtime @babel/runtime @babel/plugin-proposal-class-properties

printf "file: writing .babelrc\n"
cat <<EOF > ./.babelrc
{
  "presets": [
    "@babel/preset-env",
    "@babel/preset-react",
    "@babel/preset-typescript"
  ],
  "plugins": [
    [
      "@babel/plugin-transform-runtime",
      {
        "regenerator": true
      }
    ], "@babel/plugin-proposal-class-properties"
  ]
}
EOF

# eslint + typescript
printf "npm: installing eslint + typescript packages\n"
npm --no-audit install --save-dev eslint
npm --no-audit install --save-dev eslint-plugin-react eslint-plugin-react-hooks @typescript-eslint/parser @typescript-eslint/eslint-plugin

printf "file: writing ./src/.eslintrc.json\n"
cat <<EOF > ./src/.eslintrc.json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json",
    "sourceType": "module"
  },
  "ignorePatterns": [ ".eslintrc.json", "*.css" ],
  "plugins": [
    "@typescript-eslint",
    "react-hooks"
  ],
  "extends": [
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "no-undef": "off",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off"
  },
  "settings": {
    "react": {
      "pragma": "React",
      "version": "detect"
    }
  }
}
EOF

# webpack
printf "npm: installing webpack + typescript packages\n"
npm --no-audit install --save-dev webpack webpack-cli @types/webpack webpack-dev-server @types/webpack-dev-server css-loader style-loader babel-loader fork-ts-checker-webpack-plugin @types/fork-ts-checker-webpack-plugin

printf "file: writing webpack.config.js\n"
cat <<EOF > ./webpack.config.js
const path = require('path')
const webpack = require('webpack')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')

module.exports = {
  entry: './src/index.tsx',
  mode: 'development',
  plugins: [
    new webpack.ProvidePlugin({
      "React": "react"
    }),
    new ForkTsCheckerWebpackPlugin({
      async: false,
      eslint: {
        files: "./src/**/*"
      }
    })
    // new webpack.ProgressPlugin()
  ],
  resolve: {
    extensions: [ ".tsx", ".ts", ".js", ".jsx" ]
  },
  output: {
    path: path.resolve(__dirname, 'public')
  },
  module: {
    rules: [ {
      test: /\.(ts|js)x?$/,
      exclude: /node_modules/,
      include: [ path.resolve(__dirname, 'src') ],
      use: {
        loader: "babel-loader",
        options: {
          presets: [
            "@babel/preset-env",
            "@babel/preset-react",
            "@babel/preset-typescript"
          ]
        }
      }
    }, {
      test: /\.css$/i,
      use: [ {
        loader: "style-loader"
      }, {
        loader: "css-loader",
        options: {
          sourceMap: true
        }
      } ]
    } ]
  },
  devtool: 'inline-source-map',
  devServer: {
    open: false,
    host: 'localhost',
    contentBase: './public',
    writeToDisk: true,
    port: 4001
  }
}
EOF

# The "entry" field tells Webpack where to start looking for modules to bundle.
# In our project, this is index.tsx.

# The "module" field tells Webpack how different modules will be treated. Our
# project is telling Webpack to use the babel-loader plugin to process files
# with .js, .ts, and .tsx extensions.

# The "resolve.extensions" field tells Webpack what file types to look for in
# which order during module resolution.

# The "output" field tells Webpack where to bundle our code. In our project,
# this is the file called bundle.js in the build folder.

# The "devServer" field configures the Webpack development server. We are
# telling it that the root of the web server is the build folder, and to serve
# files on port 4001

if [[ -f ./package.json ]]; then
printf "file: writing modify_package.mjs\n"
cat <<EOF > modify_package.mjs
import path from 'path'
import { readFile, writeFile } from 'fs'

const pathName = path.resolve('./package.json') 

readFile(pathName, 'utf8', (err, data) => {
  if (err) {
    console.log(err)
    process.exit(1)
  }

  const pack = JSON.parse(data)
  const scripts = pack.scripts || {}
  scripts.start = 'webpack serve --mode development --stats minimal'
  scripts.build = 'webpack --mode production'
  pack.scripts = scripts

  writeFile(pathName, JSON.stringify(pack, null, 2), err => {
    if (err) {
      console.log(err)
    }

    process.exit(1)
  })
})
EOF
fi

printf "node: modifying package.json with scripts\n"
node modify_package.mjs
rm modify_package.mjs

printf "done\n"
