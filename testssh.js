var SSH = require('simple-ssh');
const fs = require('fs')
const path = require('path')
const key_rsa = fs.readFileSync(path.resolve(__dirname, './id_rsa'), 'utf8')

const ssh = new SSH({
    host: '0.tcp.ngrok.io',
    port: 18536,
    user: 'h',
    key : key_rsa
  });
 var rep = 'repodsfssdc';
  var promise1 = new Promise( function(resolve, reject) {
    ssh.exec('mkdir ' + rep , {
      exit : function( code, stdout, stderr ){
          if(code == 0){
            resolve("ok");
          } else {
            reject(stderr);
          }
        
      }
    }).start()
    ssh.on('error', function(err) {
        console.log("Il semble qu\'il y a un problème avec la configuration de connexion à votre serveur SSH. Vérifiez vos paramètres.");
        ssh.end();
      });
  });
  promise1.then(function(value) {
    console.log("Le repertoire a bien été créé");
 //    _self.emit(':ask',value);
    })
    .catch(function(error) {
      console.log("Problème " + error); // "zut !"
    })
    .then(function(e){
        console.log(e)
    // _self.emit(':ask',"Commande non reconnu");
});

