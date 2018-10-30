var SSH = require('simple-ssh');
const fs = require('fs')
const path = require('path')
const key_rsa = fs.readFileSync(path.resolve(__dirname, './id_rsa'), 'utf8')

var ssh = new SSH({
  'host': 'localhost', //param
  'port': 22, //param
  'user': 'h',
  'key': key_rsa //fixe 
});
 var rep = 'repodsfssdc';
 console.log(ssh.port);
ssh.port = 22;
  var promise1 = new Promise( function(resolve, reject) {
    ssh.exec('pwd' , {
      exit :  (code, stdout, stderr ) => code == 0 ? resolve(stdout) :  reject(stderr)
    }).start()
    ssh.on('error', function(err) {
      console.log(err);
        console.log("Il semble qu\'il y a un problème avec la configuration de connexion à votre serveur SSH. Vérifiez vos paramètres.");
        ssh.end();
      });
  });
  promise1.then(function(value) {
    var test = false?
     "ok" : "./";
    console.log("Vous etes bien deplacer " + test);
 //    _self.emit(':ask',value);
    })
    .catch(function(error) {
      console.log("Problème " + error); // "zut !"
    });
  

