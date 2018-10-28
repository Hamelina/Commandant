var SSH = require('simple-ssh');
const fs = require('fs')
const path = require('path')
const key_rsa = fs.readFileSync(path.resolve(__dirname, './id_rsa'), 'utf8')

const ssh = new SSH({
  host: '0.tcp.ngrok.io', //param
  port: 18674, //param
  user: 'h', //param
  key: key_rsa //fixe 
});
 var rep = 'repodsfssdc';
  var promise1 = new Promise( function(resolve, reject) {
    ssh.exec('ls | head -5' , {
      exit :  (code, stdout, stderr ) => code == 0 ? resolve(stdout) :  reject(stderr)
    }).start()
    ssh.on('error', function(err) {
      console.log(err);
        console.log("Il semble qu\'il y a un problème avec la configuration de connexion à votre serveur SSH. Vérifiez vos paramètres.");
        ssh.end();
      });
  });
  promise1.then(function(value) {
    console.log("Vous etes bien deplacer " + value.replace(/\n/g, ","));
 //    _self.emit(':ask',value);
    })
    .catch(function(error) {
      console.log("Problème " + error); // "zut !"
    });
  

