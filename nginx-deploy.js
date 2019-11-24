#!/usr/bin/env node

// https://scotch.io/tutorials/build-an-interactive-command-line-application-with-nodejs
const program    = require('commander');
const { prompt } = require('inquirer');
const _          = require('lodash');

const path = require('path');
const fs   = require('fs');

program
  .version('1.0.0')
  .description('Nginx deploy utility command');

const questions = [{
    type: 'input',
    name: 'appName',
    message: 'App name (no spaces): ',
    validate: function (value) {
      var valid = !!value || value.trim() !== '';
      return valid || 'App name is required';
    },
  },
  {
    type: 'confirm',
    name: 'useSubdomain',
    default: false,
    message: 'Use subdomain (eg. subdomain.server.com): '
  },
  {
    type: 'input',
    name: 'appFolder',
    message: 'App folder (eg. /opt/app_folder , full path): ',
    when: function (answers) {
      return answers.useSubdomain;
    },
    validate: function (value) {
      var valid = !!value || value.trim() !== '';
      return valid || 'App folder is required';
    },
  },
  {
    type: 'input',
    name: 'subdomain',
    message: 'Subdomain (eg. subdomain.server.com , including server domain): ',
    when: function (answers) {
      return answers.useSubdomain;
    },
    validate: function (value) {
      var valid = !!value || value.trim() !== '';
      return valid || 'Subdomain is required';
    },
  },
  {
    type: 'input',
    name: 'targetDir',
    message: 'Target folder (eg. domain.com/target_folder , target_folder only): ',
    when: function (answers) {
      return !answers.useSubdomain;
    },
    validate: function (value) {
      var valid = !!value || value.trim() !== '';
      return valid || 'Target dir is required';
    },
  },
  {
    type: 'input',
    name: 'targetServer',
    message: 'Node server: ',
    default: 'localhost'
  },
  {
    type: 'input',
    name: 'targetPort',
    message: 'Node server port: ',
    default: 8080,
    validate: function (value) {
      var valid = !isNaN(parseFloat(value));
      return valid || 'Please enter a number';
    },
    filter: Number
  }
];

// Ref.: https://gist.github.com/drodsou/de2ba6291aea67ffc5bc4b52d8c32abd
// like writeFileSync but creates all folder paths if not exist
// ----------------------------------------------------------
function writeFileSyncRecursive(filename, content, charset) {
  charset = (!charset) ? 'utf8' : charset;
  let folders = filename.split(path.sep).slice(0, -1);
  folders[0] = (folders[0] === '') ? '/' : folders[0];
  if (folders.length) {
    // create folder path if it doesn't exist
    folders.reduce((last, folder) => {
      const folderPath = last ? last + path.sep + folder : folder
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
      }
      return folderPath
    })
  }
  fs.writeFileSync(filename, content, { encoding: charset, mode: 0o744, flag: 'w' });
}

function createSettingsFile(answers) {
  let content;
  let fileName;
  let templateFile;
  let compiledTemplate;
  if (answers.useSubdomain) {
    fileName = `${__dirname}${path.sep}${answers.appName + '-nginx'}${path.sep}${answers.subdomain}`;
    templateFile     = fs.readFileSync(path.join(__dirname, 'subdomain.tmpl'), 'utf8');
    compiledTemplate = _.template(templateFile);
    content          = compiledTemplate(answers);
  } else {
    fileName = `${__dirname}${path.sep}${answers.appName + '-nginx'}${path.sep}${answers.appName}.config`;
    templateFile     = fs.readFileSync(path.join(__dirname, 'folder.tmpl'), 'utf8');
    compiledTemplate = _.template(templateFile);
    content          = compiledTemplate(answers);
  }
  writeFileSyncRecursive(fileName, content);
  console.log('File must be created at: ', fileName);

  if (answers.useSubdomain) {
    console.log('To enable subdomain run these commands in order: ');
    console.log('sudo su -');
    console.log(`mv ${fileName} /etc/nginx/sites-available/`);
    console.log(`ln -s /etc/nginx/sites-available/${answers.subdomain} /etc/nginx/sites-enabled/${answers.subdomain}`);
    console.log(`service nginx restart`);
  } else {
    console.log(`To enable web site on folder ${answers.targetDir} run these commands in order: `);
    console.log('sudo su -');
    console.log(`mv ${fileName} /etc/nginx/conf.d/`);
    console.log(`echo 'include /etc/nginx/conf.d/${answers.appName}.config;' >> /etc/nginx/conf.d/apps.config`);
    console.log(`service nginx restart`);
  }
}

program
  .command('interactive')
  .alias('i')
  .description('Deploys NodeJS app interactively to an nginx server writing the configuration files.')
  .action(() => {
    prompt(questions).then(
      answers => {
        console.log('Creating settings file with this options: \n', answers);
        createSettingsFile(answers);
      },
      err => console.error('Weird, this shouldn\'t happen...', err)
    );
  });

program.parse(process.argv);
