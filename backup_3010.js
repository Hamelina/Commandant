'use strict';
var SSH = require('simple-ssh');
const fs = require('fs')
const path = require('path')
const Alexa = require('alexa-sdk');

const AWS = require('aws-sdk'),
  uuid = require('uuid');
  var documentClient = new AWS.DynamoDB.DocumentClient(); 
  
  // Set the region 
  AWS.config.update({region: 'eu-west-1'});

const key_rsa = fs.readFileSync(path.resolve(__dirname, './id_rsa'), 'utf8')
const APP_ID = process.env.APP_ID;

const SKILL_NAME = 'Commandant';
const HELP_MESSAGE = 'Vous pouvez me donner un ordre or dire quitter pour arreter l\'execution... Que puis-je faire pour vous?';
const HELP_REPROMPT = 'Comment puis-je vous aider?';
const STOP_MESSAGE = 'Au revoir!';
const UNHANDLED_MESSAGE =  "Désolé je n'ai pas compris ça";
const ERREUR_SSH = "Il semble qu\'il y a un problème avec votre connexion SSH. Vérifiez vos paramètres."
//const sshConfig = chargerConfigSSH("23");
//const userId = this.event.session.user.userId;
var ssh = new SSH({
  'key': key_rsa //fixe 
});
var repertoireCourant = "./";
var host;
var port;
var username;
function chargerConfigSSH(userId, callback){
  console.log(userId);
  var params = {
    Key: {
      "ID": userId
    },
    TableName : 'users'
  };
  return documentClient.get(params, function(err, data){
    if (err ){
      console.log("Error", err, data);
      callback(err, data);
    } else if (!data.Item){ // premiere fois 
      callback("Premiere", data);
    } else {
      console.log("Success", data);
      repertoireCourant = data.Item.currentRepertory ?
        (data.Item.currentRepertory).replace(/\n/g,"") : "./";
      ssh =  new SSH({
        'host': data.Item.host, //param
        'port':  data.Item.port, //param
        'user': data.Item.username,//param
        'key': key_rsa, 
        'baseDir': repertoireCourant // se deplace dans le rep enregistré ou par defaut le repertoire actuel (home)
      });
      callback(null, repertoireCourant); 
    }
  })
}
function etablirConnexionSSH(userId, callback){
  const sshConfig = loadSSHConfig(userId)
  return new SSH(sshConfig)
}



function majConfigSSH(userId, host, port, userName, callback){
  var params = {
    Key: {
      Id : userId
    },
    ExpressionAttributeValues: {
      ':host' : host,
      ':port' : port,
      ':userName' : userName
    },
    UpdateExpression: 'set host = :host, port = :port, username = :userName',
    TableName : 'users'
  };
return documentClient.update(params, callback)
}

function majRepertoireActuel(userId,nouveauRepertoire, callback){
  var params = {
    Key: {
      'ID' : userId
    },
    ExpressionAttributeValues: {
      ':nouveauRep' : nouveauRepertoire.replace(/ .*/,'').replace(/\n/g, ""),
    },
    UpdateExpression: 'set currentRepertory = :nouveauRep',
    TableName : 'users', 
    ReturnValues:"UPDATED_NEW"
  };
  return documentClient.update(params, function(err, data){
    if (err){
      console.log("Error", err, data);
      callback(err, data);
    }
    else {
      console.log("Success", data);
      callback(null,data.Attributes.currentRepertory);
    }
  })
}

function addConfigSSH(userId, host, port, username, callback){
  var params = {
      TableName:'users',
      Item:{
          "ID" : userId,
          "host": host,
          "port": port,
          "username": username
      }
  };
  return documentClient.put(params, callback)
}

const handlers = {
  'LaunchRequest': function () { 
  let _self=this;
  chargerConfigSSH(this.event.session.user.userId, function(err, cheminActuel) {
  if(err){
    err == "Premiere" ? 
     _self.emit(':ask', 'Bienvenue dans votre gestionnaire de fichiers. Il s’agit de votre première utilisation. Commandant vous permet de gérer vos dossiers, fichiers, et pour les plus aguerri: le versionning de votre code avec Github. Commencez par configurer votre connexion SSH. Dites configuration.') 
   : _self.emit(':ask', ERREUR_SSH);
   } else {
    repertoireCourant = cheminActuel;
    _self.emit(':ask', "Commandant à votre écoute, quelle commande voulez-vous lancer ?" );
    }
  });
},
  'Config': function () {
    this.emit(':ask', "Nous allons commencer la configuration, donnez moi votre nom de domaine. Pour cela dites 'Mon domaine est ...suivi du nom votre de domaine', Merci");
  },
  'ConfigHost': function () {
    host = this.event.request.intent.slots.host.value;
    this.emit(':ask', "Votre domaine est "+host+"? Pour passer à la configuration de votre nom d'utilisateur dites: 'Mon nom est ...suivi de votre nom d'utilisateur sinon redites 'Mon domaine est ...suivi du votre nom de domaine'");
  },
  'ConfigUsername': function () {
   username = this.event.request.intent.slots.nomUtilisateur.value;
    this.emit(':ask', "Votre nom d'utilisateur est "+username+"? Pour passer à la configuration du port dites: 'Mon port est ...suivi du numero de port sinon redites 'Mon nom est ...suivi de votre nom d'utilisateur'");
  },
  'ConfigPort': function () {
    let _self = this;
    port = this.event.request.intent.slots.port.value;
    majConfigSSH(_self.event.session.user.userId, host, port, username, function(err, data){
      if(err){
        addConfigSSH(_self.event.session.user.userId, host, port, username, function(err, data){
          if(err) {
            _self.emit(':ask', "La configuration a échouée, veuillez verifier vos parametres.");
          } else {
           _self.emit(':ask', "La configuration est terminée. Votre domaine est"+host+", votre nom d'utilisateur est "+username+", votre port est "+port);
          }
       });
      } 
      else { 
          _self.emit(':ask', "La configuration est terminée. Votre domaine est"+host+", votre nom d'utilisateur est "+username+", votre port est "+port);
       }
    });
  },
  'CmdPWD': function () {
    let _self = this;
    chargerConfigSSH(this.event.session.user.userId, function(err, cheminActuel) {
      if(err){
       console.log(err)
       _self.emit(':ask', ERREUR_SSH);
      } else {
        let promesse = new Promise( function(resolve, reject) {
          ssh.exec('pwd', { 
            exit :  (code, stdout, stderr ) => code == 0 ? resolve(stdout) :  reject(stderr) 
          }).start()
          ssh.on('error', function(err) {
            console.log(err);
            _self.emit(':ask', ERREUR_SSH);
            ssh.end();
          });
        });
        promesse.then(function(value) {
          console.log(value);  
          _self.emit(':ask', "Je me trouve actuellement au : " + value);
            })
          .catch(function(e) {
            console.log(e); // "erreur avec la commande"
            _self.emit(':ask', "J'ai du mal à rejoindre votre dossier personnel, verifiez vos parametres");
          })
         }
    });
  },

  'CmdLS': function () {
    let _self = this;
    chargerConfigSSH(this.event.session.user.userId, function(err, cheminActuel) {
      if(err) {
       console.log(err)
       _self.emit(':ask', ERREUR_SSH);
      } else {
        let promesse = new Promise( function(resolve, reject) {
          ssh.exec("ls | head -5", { 
            exit :  (code, stdout, stderr ) => code == 0 ? resolve(stdout) :  reject(stderr)
          }).start()
          ssh.on('error', function(err) {
            _self.emit(':ask', ERREUR_SSH);
            ssh.end();
          });
        });
        promesse.then(function(value) {
            if(value){
               console.log(value);  
              _self.emit(':ask', "Les 5 premiers éléments du répertoire sont : " + value.replace(/\n/g, ","));
            } else {
              _self.emit(':ask', "Le répertoire est vide");
            } })
          .catch(function(e) {
            console.log(e); // "erreur avec la commande"
            _self.emit(':ask', "Je n'arrive pas à lister vos fichiers.");
          });
         }
       });
    },
    
 'CmdMKDIR': function () {
      var nomRepertoire;
      let  intentObj = this.event.request.intent;
      let _self = this;
      chargerConfigSSH(this.event.session.user.userId, function(err, cheminActuel) {
        if(err){
         console.log(err)
         _self.emit(':ask', ERREUR_SSH);
        } else {
          if(!intentObj.slots.nomRepertoire.value){
            const slotToElicit = 'nomRepertoire'
            const speechOutput = 'Quel est le nom du nouveau répertoire'
            const repromptSpeech = 'Dites moi le nom du nouveau répertoire'
            const updatedIntent = 'CmdMKDIR'
            return _self.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech)
          }
           // Confirm slot: Type
          if (intentObj.slots.nomRepertoire.confirmationStatus !== 'CONFIRMED') {
            if (intentObj.slots.nomRepertoire.confirmationStatus !== 'DENIED') {
              // slot status: unconfirmed
              const slotToConfirm = 'nomRepertoire'
              let intentValue = intentObj.slots.nomRepertoire.value;
              nomRepertoire = intentValue.replace(/ .*/,'');     // par precaution, on recupere juste le premier mot de la chaine donné par l'utilisateur
              const speechOutput = 'Vous voulez créer le répertoire au nom de ' + nomRepertoire + ', est-ce exact?'
              const repromptSpeech = speechOutput
              return _self.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech)
            }
          else {
            const slotToElicit = 'nomRepertoire'
            const speechOutput = 'Quel est le nom du nouveau répertoire'
            const repromptSpeech = 'Dites moi le nom du nouveau répertoire'
            const updatedIntent = 'CmdMKDIR'
            return _self.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech)
            }
         } 
          let intentValue = intentObj.slots.nomRepertoire.value;
          nomRepertoire = intentValue.replace(/ .*/,''); 
          if(nomRepertoire){
            let promesse = new Promise( function(resolve, reject) {
            ssh.exec('mkdir', {
              args: [nomRepertoire],
              exit :  (code, stdout, stderr ) => code == 0 ? resolve("ok") :  reject(stderr)
            }).start()
            ssh.on('error', function(err) {
              console.log(err);
              _self.emit(':ask', ERREUR_SSH);
              ssh.end();
            });
          });
          promesse.then(function(value) {
            // console.log(value);
            _self.emit(':ask', "Le répertoire " + nomRepertoire + " a bien été créé");
            })
            .catch(function(e) {
              console.log(e); // erreur
              _self.emit(':ask', "Le dossier actuel contient déjà un répertoire sous ce nom");
            });
            }
           }
      });
},

'CmdCD': function () {
  let _self = this;
  chargerConfigSSH(this.event.session.user.userId, function(err, cheminActuel) {
    if(err) {
       console.log(err)
       _self.emit(':ask', ERREUR_SSH);
    } else {
      let cheminBrut = _self.event.request.intent.slots.chemin.value;
      let chemin = cheminBrut.replace(/ .*/,''); //on recupere juste le premier ensemble de la chaine
      // console.log(chemin);
      let promesse = new Promise( function(resolve, reject) {
        ssh.exec("cd " + chemin + " && pwd", {
          exit :  (code, stdout, stderr ) => code == 0 ? resolve(stdout) :  reject(stderr)
        }).start()
        ssh.on('error', function(err) {
          _self.emit(':ask', ERREUR_SSH);
          ssh.end();
        });
      });
      promesse.then(function(value) {
        majRepertoireActuel(this.event.session.user.userId, value, function(err, res){
          if(err){
            console.log(err); // "erreur avec la commande"
            _self.emit(':ask', "Je n'arrive pas à me deplacer dans le chemin");
          } else {
            console.log(res);
            repertoireCourant = res;
            _self.emit(':ask', "Je suis maintenant dans " + res);
            }
        })
      })
      .catch(function(e) {
        console.log(e); // "erreur avec la commande"
        _self.emit(':ask', "Je n'arrive pas à me deplacer dans le chemin, il est surement incorrect.");
      });
    }
 });

  },

  'CmdRM': function () {
    let _self = this;
    chargerConfigSSH(this.event.session.user.userId, function(err, cheminActuel) {
      if(err){
       console.log(err)
       _self.emit(':ask', ERREUR_SSH);
      } else {
        let  intentObj = _self.event.request.intent;
        var nomFichier;
        var intentValue;
        if(!intentObj.slots.nomFichier.value){
          const slotToElicit = 'nomFichier'
          const speechOutput = 'Quel est le nom du fichier à supprimer'
          const repromptSpeech = 'Dites moi le nom du fichier à supprimer'
          const updatedIntent = 'CmdRM'
          return _self.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech)
        }
         // Confirm slot: Type
        if (intentObj.slots.nomFichier.confirmationStatus !== 'CONFIRMED') {
          if (intentObj.slots.nomFichier.confirmationStatus !== 'DENIED') {
            // slot status: unconfirmed
            const slotToConfirm = 'nomFichier'
            intentValue = intentObj.slots.nomFichier.value;
            nomFichier = intentValue.replace(/ .*/,'');     // par precaution, on recupere juste le premier mot de la chaine donné par l'utilisateur
            const speechOutput = 'Vous voulez supprimer le fichier au nom de ' + nomFichier + ', est-ce exact?'
            const repromptSpeech = speechOutput
            return _self.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech)
          }
        else {
          const slotToElicit = 'nomFichier'
          const speechOutput = 'Quel est le nom du fichier à supprimer'
          const repromptSpeech = 'Dites moi le nom du fichier à supprimer'
          const updatedIntent = 'CmdMKDIR'
          return _self.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech)
          }
       } 
       intentValue = intentObj.slots.nomFichier.value;
       nomFichier = intentValue.replace(/ .*/,'');  //on recupere juste le premier ensemble de la chaine
       if(nomFichier){
        let promesse = new Promise( function(resolve, reject) {
          ssh.exec('rm', {
            args:  [nomFichier],
            exit :  (code, stdout, stderr ) => code == 0 ? resolve("ok") :  reject(stderr)
          }).start()
          ssh.on('error', function(err) {
            _self.emit(':ask', ERREUR_SSH);
            ssh.end();
          });
        });
        promesse.then(function(value) {
          // console.log(value);
           _self.emit(':ask', "Le fichier " + nomFichier + " a été supprimé");
          })
          .catch(function(e) {
            console.log(e); // erreur
            _self.emit(':ask', "Je n'arrive pas à supprimer ce fichier");
          });
           }
         }
    }); 
},
'CmdRMR': function () {
  let _self = this;
  chargerConfigSSH(this.event.session.user.userId, function(err, cheminActuel) {
    if(err){
        console.log(err)
        _self.emit(':ask', ERREUR_SSH);
    } else {
        let  intentObj = _self.event.request.intent;
        var nomFichier;
        var intentValue;
      if(!intentObj.slots.nomFichier.value){
        const slotToElicit = 'nomFichier'
        const speechOutput = 'Quel est le nom du répertoire à supprimer'
        const repromptSpeech = 'Dites moi le nom du répertoire à supprimer'
        const updatedIntent = 'CmdRM'
        return _self.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech)
      }
      // Confirm slot: Type
      if (intentObj.slots.nomFichier.confirmationStatus !== 'CONFIRMED') {
        if (intentObj.slots.nomFichier.confirmationStatus !== 'DENIED') {
          // slot status: unconfirmed
          const slotToConfirm = 'nomFichier'
          intentValue = intentObj.slots.nomFichier.value;
          nomFichier = intentValue.replace(/ .*/,'');     // par precaution, on recupere juste le premier mot de la chaine donné par l'utilisateur
          const speechOutput = 'Vous voulez supprimer le répertoire au nom de ' + nomFichier + ', est-ce exact?'
          const repromptSpeech = speechOutput
          return  _self.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech)
        }
      else {
        const slotToElicit = 'nomFichier'
        const speechOutput = 'Quel est le nom du répertoire à supprimer'
        const repromptSpeech = 'Dites moi le nom du répertoire à supprimer'
        return _self.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech)
        }
    } 
    intentValue = intentObj.slots.nomFichier.value;
    nomFichier = intentValue.replace(/ .*/,'');  //on recupere juste le premier ensemble de la chaine
    if(nomFichier){
      let promesse = new Promise( function(resolve, reject) {
        ssh.exec('rm -R', {
          args:  [nomFichier],
          exit :  (code, stdout, stderr ) => code == 0 ? resolve("ok") :  reject(stderr)
        }).start()
        ssh.on('error', function(err) {
          _self.emit(':ask', ERREUR_SSH);
          ssh.end();
        });
      });
      promesse.then(function(value) {
        // console.log(value);
        _self.emit(':ask', "Le répertoire " + nomFichier + " a été supprimé");
        })
        .catch(function(e) {
          console.log(e); // erreur
          _self.emit(':ask', "Je n'arrive pas à supprimer ce répertoire");
        });
       }
    }
  });
},

'CmdGITPULL': function () {
    let _self = this;
    chargerConfigSSH(this.event.session.user.userId, function(err, cheminActuel) {
      if(err){
       console.log(err)
       _self.emit(':ask', ERREUR_SSH);
      } else {
        let promesse = new Promise( function(resolve, reject) {
          ssh.exec('git pull --rebase', {
            exit :  (code, stdout, stderr ) => code == 0 ? resolve(stdout) :  reject(stderr)
          }).start()
          ssh.on('error', function(err) {
            _self.emit(':ask', ERREUR_SSH);
            ssh.end();
          });
        });
        promesse.then(function(value) {
          // console.log(value);
           _self.emit(':ask', "Les changements ont bien été pris en compte, vous êtes à jour");
          })
          .catch(function(e) {
            console.log(e); // erreur
            _self.emit(':ask', "Il semblerait qu’une erreur est apparue. Veuillez vérifier vos fichiers");
          });
         }
    });
    
  },
  
  'CmdGITCOMMIT': function () {
    let _self = this;
    chargerConfigSSH(this.event.session.user.userId, function(err, cheminActuel) {
      if(err){
       console.log(err)
       _self.emit(':ask', ERREUR_SSH);
      } else {
        let message = this.event.request.intent.slots.commitMessage.value;

        let promesse = new Promise( function(resolve, reject) {
          ssh.exec('git commit -m '+ message, {
            exit :  (code, stdout, stderr ) => code == 0 ? resolve(stdout) :  reject(stderr)
          }).start()
          ssh.on('error', function(err) {
            _self.emit(':ask', ERREUR_SSH);
            ssh.end();
          });
        });
        promesse.then(function(value) {
          // console.log(value);
           _self.emit(':ask', "Les fichiers ont bien été commit");
          })
          .catch(function(e) {
            console.log(e); // erreur
            _self.emit(':ask', "Je n'arrive pas à commit");
          });
         }
    });
   
  },
  
  'CmdGITADD': function () {
    let _self = this;
    chargerConfigSSH(this.event.session.user.userId, function(err, cheminActuel) {
      if(err){
       console.log(err)
       _self.emit(':ask', ERREUR_SSH);
      } else {
        let promesse = new Promise( function(resolve, reject) {
          ssh.exec('git add .'+ message, {
            exit :  (code, stdout, stderr ) => code == 0 ? resolve(stdout) :  reject(stderr)
          }).start()
          ssh.on('error', function(err) {
            _self.emit(':ask', ERREUR_SSH);
            ssh.end();
          });
        });
        promesse.then(function(value) {
          // console.log(value);
           _self.emit(':ask', "Très bien. Je vais ajouter tous les changements sur les fichiers actuels à votre git. Quel message voulez-vous donner à votre commit ? ");
          })
          .catch(function(e) {
            console.log(e); // erreur
            _self.emit(':ask', "Je n'arrive pas à ajouter vos changements. Vérifiez vos fichiers.");
          });
         }
    });
   
  },

  'AddUser': function () {
    var params = {
      Item : {
        "Id" : this.event.session.user.userId,
        "host" : this.event.host,
        "port" : this.event.port,
        "username" : this.event.user
       // "Key" : this.event.key la clé est unique a notre projet
      },
      TableName : 'users'
    };

    documentClient.put(params, function(err, data){
      if (err)
        console.log("Error", err, data);
      else 
        this.emit(':tell','Profil ajouté avec succès !')
    }.bind(this));
  },

  'updateUser': function () {
    var params = {
      userId : this.event.session.user.userId,
      host : this.event.host,
      port : this.event.port,
      userName : this.event.userName
    };
    console.log("HERE")
    majConfigSSH(this.event.session.user.userId,
                      this.event.host,
                      this.event.port, 
                      this.event.userName,
                      function(err, data){
      if (err)
        console.log("Error", err, data);
      else 
        this.emit(':ask','Profil mis à jour avec succès !')
    }.bind(this));
  },

  'findUser': function () {
    var params = {
      ExpressionAttributeValues: {
        ':name' : {S: this.event.name}
      },
      FilterExpression: 'contains (FirstName, :name)',
      TableName : 'users'
    };
    documentClient.scan(params, function(err, data){
      if (err){
        console.log("Error", err, data);
      }
      else {
        console.log(data);
        this.emit(':tell',data)    
      }
    });
  },
  
  'AMAZON.HelpIntent': function () {
    const speechOutput = HELP_MESSAGE;
    const reprompt = HELP_REPROMPT;

    this.response.speak(speechOutput).listen(reprompt);
    this.emit(':responseReady');
  },
  'AMAZON.CancelIntent': function () {
      this.response.speak(STOP_MESSAGE);
      this.emit(':responseReady');
  },
  'AMAZON.StopIntent': function () {
      this.response.speak(STOP_MESSAGE);
      this.emit(':responseReady');
  },
  'Unhandled': function () {
    this.response.speak(UNHANDLED_MESSAGE);
    this.emit(':responseReady');
  },
}

exports.handler = function (event, context, callback) {
  const alexa = Alexa.handler(event, context, callback);
  alexa.APP_ID = APP_ID;
  alexa.registerHandlers(handlers);
  alexa.execute();
};
