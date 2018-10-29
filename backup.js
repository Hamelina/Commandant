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
const HELLO_MESSAGE = "Salut !";
const HELP_MESSAGE = 'You can say tell me a space fact, or, you can say exit... What can I help you with?';
const HELP_REPROMPT = 'Comment je peux t\'aider?';
const STOP_MESSAGE = 'Au revoir!';
const UNHANDLED_MESSAGE =  "Désolé je n'ai pas compris ça";
const ERREUR_SSH = "Il semble qu\'il y a un problème avec votre connexion SSH. Vérifiez vos paramètres."
//const sshConfig = chargerConfigSSH("23");

var ssh = new SSH({
  'key': key_rsa //fixe 
});

var repertoireCourant = "./";
function chargerConfigSSH(userId, callback){
  var params = {
    Key: {
      "ID": userId
    },
    TableName : 'users'
  };
  return documentClient.get(params, function(err, data){
    if (err){
      console.log("Error", err, data);
      callback(err, response);
    }
    else {
      console.log("Success", data);
      repertoireCourant = (data.Item.currentRepertory).replace(/\n/g,"");
      ssh =  new SSH({
        'host': data.Item.host, //param
        'port':  16555, //param
        'user': data.Item.username,//param
        'key': key_rsa, 
        'baseDir': repertoireCourant // se deplace dans le rep enregistré ou par defaut le repertoire actuel (home)
      });
      console.log(ssh);

      callback(null, repertoireCourant); 
    }
  })
}
function etablirConnexionSSH(userId, callback){
  const sshConfig = loadSSHConfig(userId)
  return new SSH(sshConfig)
}
function recupereRepertoireCourant(userId, callback){
  var params = {
    TableName: 'users',
    Key:{
        "ID": userId
      }
    };
      documentClient.get(params, function(err, data) {
        if (err) {
            console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
            callback(err, response);
        } else {
            console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
           call(null,data.Item.currentDirectory); // currentDirectory = nom de l'attribut qui contient le rep courant
        }
    });
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
function addSSHconfig(username,host,port){
  var params = {
    TableName:'users',
    Item:{
        "ID" : '24',
        "host": host,
        "port": port,
        "uername": username

    }
  };
  
  console.log("Adding a new sshconfig...");
  docClient.put(params, function(err, data) {
    if (err) {
        console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
    } else {
        console.log("Added item:", JSON.stringify(data, null, 2));
    }
  });
  
}

const handlers = {
  'LaunchRequest': function () { 
  let _self=this;
//  console.log(ssh);
//console.log("ON Y EST");
 //console.log("Le repertoire courant est " + repertoireCourant);
 chargerConfigSSH('23', function(err, result) {
   if(err){
    console.log(err)
    _self.emit(':ask', ERREUR_SSH);
   } else {
        repertoireCourant = result;
        _self.emit(':ask', "Bienvenue, vous etes au repertoire " + repertoireCourant );
      }
 });
  
},
'ModifConfig': function() {
  let _self = this;
  let promesse = new Promise( function(resolve, reject) {
   var data =  majRepertoireActuel('23','/home/h')
   resolve(data)
  });
  promesse.then(function(value) {
    repertoireCourant = value.attributes.currentDirectory;
    _self.emit(':ask', "modif ok?");
  })
  .catch(function(e) {
    console.log(e); // "erreur avec la commande"
    _self.emit(':ask', "verifiez vos parametres");
  });

},
  'AddConfig': function () {
    var _self = this;
    //verifier la connexion - param vide
   var username = 'h';
   var host = '0.tcp.ngrok.io';
   var port = 16828;
   var params = {
    TableName:'users',
    Item:{
        "ID" : '24',
        "host": host,
        "port": port,
        "username": username
    }
  };
  
  console.log("Adding a new sshconfig...");
  documentClient.put(params, function(err, data) {
    if (err) {
        console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      _self.emit("LancementUsuel");
        console.log("Added item:", JSON.stringify(data, null, 2));
    }
  });
   //addSSHconfig(username,host,port);
       // configuration
  // sinon 
    ///  
    //this.emit("PremiereFois");
    },

  'LancementUsuel': function () {
      console.log("Port lancement usuel " + ssh.port);
      console.log("usuel lancement " + ssh.user);
      console.log("usle Host lancement " + ssh.host);
      
      let _self = this;
      let promesse = new Promise( function(resolve, reject) {
        ssh.exec('pwd', {  // Commande de test
          exit :  (code, stdout, stderr ) => code == 0 ? resolve("ok") :  reject(stderr)
        }).start()
        ssh.on('error', function(err) {
          console.log(err);
          _self.emit(':ask', ERREUR_SSH);
          ssh.end();
        });
      });
      promesse.then(function(value) {
          _self.emit(':ask', "Commandant à votre écoute ! Quelle commande voulez-vous lancer ?");
        })
        .catch(function(e) {
          console.log(e); // "erreur avec la commande"
          _self.emit(':ask', "J'ai du mal à rejoindre votre dossier personnel, verifiez vos parametres");
        });
     },  

  'PremiereFois': function () {
      let _self = this;
      let promesse = new Promise( function(resolve, reject) {
        ssh.exec('pwd', { 
          exit :  (code, stdout, stderr ) => code == 0 ? resolve("ok") :  reject(stderr)
        }).start()
        ssh.on('error', function(err) {
          _self.emit(':ask', ERREUR_SSH);
          ssh.end();
        });
      });
      promesse.then(function(value) {
        console.log(value);  
          _self.emit(':ask', 'Bienvenue dans votre gestionnaire de fichiers. Il s’agit de votre première utilisation. Commandant vous permet de gérer vos dossiers, fichiers, et pour les plus aguerri: le versionning de votre code avec Github. Actuellement vous être à votre répertoire personnel. Que voulez vous faire ?');
        })
        .catch(function(e) {
         console.log(e); // "erreur avec la commande"
          _self.emit(':ask', "J'ai du mal à rejoindre votre dossier personnel, verifiez vos parametres");
               });
     },  

  'CmdPWD': function () {
    let _self = this;
    chargerConfigSSH('23', function(err, cheminActuel) {
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
    chargerConfigSSH('23', function(err, cheminActuel) {
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
              _self.emit(':ask', "Le repertoire est vide");
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
      if(!intentObj.slots.nomRepertoire.value){
        const slotToElicit = 'nomRepertoire'
        const speechOutput = 'Quel est le nom du nouveau repertoire'
        const repromptSpeech = 'Dites moi le nom du nouveau repertoire'
        const updatedIntent = 'CmdMKDIR'
        return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech)
      }
       // Confirm slot: Type
      if (intentObj.slots.nomRepertoire.confirmationStatus !== 'CONFIRMED') {
        if (intentObj.slots.nomRepertoire.confirmationStatus !== 'DENIED') {
          // slot status: unconfirmed
          const slotToConfirm = 'nomRepertoire'
          let intentValue = intentObj.slots.nomRepertoire.value;
          nomRepertoire = intentValue.replace(/ .*/,'');     // par precaution, on recupere juste le premier mot de la chaine donné par l'utilisateur
          const speechOutput = 'Vous voulez créer le repertoire au nom de ' + nomRepertoire + ', est-ce exact?'
          const repromptSpeech = speechOutput
          return this.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech)
        }
      else {
        const slotToElicit = 'nomRepertoire'
        const speechOutput = 'Quel est le nom du nouveau repertoire'
        const repromptSpeech = 'Dites moi le nom du nouveau repertoire'
        const updatedIntent = 'CmdMKDIR'
        return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech)
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
       _self.emit(':ask', "Le répertoire " + nomRepertoire + "a bien été créé");
      })
      .catch(function(e) {
        console.log(e); // erreur
        _self.emit(':ask', "Le dossier actuel contient déjà un repertoire sous ce nom");
      });
  }
},

'CmdCD': function () {
  let _self = this;
  chargerConfigSSH('23', function(err, cheminActuel) {
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
        majRepertoireActuel('23', value, function(err, res){
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
    let  intentObj = this.event.request.intent;
    let _self = this;
    var nomFichier;
    var intentValue;
    if(!intentObj.slots.nomFichier.value){
      const slotToElicit = 'nomFichier'
      const speechOutput = 'Quel est le nom du fichier à supprimer'
      const repromptSpeech = 'Dites moi le nomdu fichier à supprimer'
      const updatedIntent = 'CmdRM'
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech)
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
        return this.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech)
      }
    else {
      const slotToElicit = 'nomFichier'
      const speechOutput = 'Quel est le nom du fichier à supprimer'
      const repromptSpeech = 'Dites moi le nomdu fichier à supprimer'
      const updatedIntent = 'CmdMKDIR'
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech)
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
},
'CmdRMR': function () {
  let  intentObj = this.event.request.intent;
  let _self = this;
  var nomFichier;
  var intentValue;
  if(!intentObj.slots.nomFichier.value){
    const slotToElicit = 'nomFichier'
    const speechOutput = 'Quel est le nom du repertoire à supprimer'
    const repromptSpeech = 'Dites moi le nom du repertoire à supprimer'
    const updatedIntent = 'CmdRM'
    return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech)
  }
   // Confirm slot: Type
  if (intentObj.slots.nomFichier.confirmationStatus !== 'CONFIRMED') {
    if (intentObj.slots.nomFichier.confirmationStatus !== 'DENIED') {
      // slot status: unconfirmed
      const slotToConfirm = 'nomFichier'
      intentValue = intentObj.slots.nomFichier.value;
      nomFichier = intentValue.replace(/ .*/,'');     // par precaution, on recupere juste le premier mot de la chaine donné par l'utilisateur
      const speechOutput = 'Vous voulez supprimer le repertoire au nom de ' + nomFichier + ', est-ce exact?'
      const repromptSpeech = speechOutput
      return this.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech)
    }
  else {
    const slotToElicit = 'nomFichier'
    const speechOutput = 'Quel est le nom du repertoire à supprimer'
    const repromptSpeech = 'Dites moi le nom du repertoire à supprimer'
    return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech)
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
     _self.emit(':ask', "Le repertoire " + nomFichier + " a été supprimé");
    })
    .catch(function(e) {
      console.log(e); // erreur
      _self.emit(':ask', "Je n'arrive pas à supprimer ce repertoire");
    });
 }
},

'CmdGITPULL': function () {
    let _self = this;
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
  },
  
  'CmdGITCOMMIT': function () {
    let _self = this;
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
       _self.emit(':ask', "Les fichiers ont bien été commités ");
      })
      .catch(function(e) {
        console.log(e); // erreur
        _self.emit(':ask', "Je n'arrive pas à commit");
      });
  },
  
  'CmdGITADD': function () {
    let _self = this;
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
        _self.emit(':ask', "Je n'arrive pas à ajouter vos changements");
      });
  },

  'choiceAction': function () {
    if(this.event.request.intent.slots.choiceActionHealth.value ==="consulter"){
      this.emit(':ask',"Donnez moi le nom du médicament à consulter ?")
    }else if(this.event.request.intent.slots.choiceActionHealth.value ==="ajouter"){
      this.emit(':ask',"Qu'elle est le nom du médicament à ajouter ?")
    }
},

  'choiceAddMedicine': function () {
    this.attributes.nameMedecine = this.event.request.intent.slots.nameMedecine.value
    this.emit(':ask',"Quel est la dose de "+ this.event.request.intent.slots.nameMedecine.value + " ?")
},

'choiceDose': function () {
  this.attributes.doseMedecine = this.event.request.intent.slots.doseValue.value
  this.attributes.typeDoseMedecine = this.event.request.intent.slots.typeDose.value
  this.emit(':ask',"Quelle est la durée du traitement ?")
},
'durationMedecine': function () {
  this.attributes.numberDurationMedecine = this.event.request.intent.slots.durationNumber.value
  this.attributes.typeDurationMedecine = this.event.request.intent.slots.durationType.value
  this.emit(':ask',"Nous allons lister les heures de prises quotidiennes, donnez moi la première heure de prise de la journée")
},
'giveHours': function () {
  if(this.attributes.hoursMedicine){
    this.attributes.hoursMedicine.push(this.event.request.intent.slots.hour.value)
  }else{
    this.attributes.hoursMedicine = [this.event.request.intent.slots.hour.value]
  }
  this.emit(':ask',"L'heure a été ajouté, avez-vous d'autres heures, répondez oui ou non")
},
'reapeatHour': function () {
  if(this.event.request.intent.slots.responseRepeat.value === "oui"){
    this.emit(':ask',"Donner une nouvelle heure")
  }else if(this.event.request.intent.slots.responseRepeat.value === "non"){
    /*this.emit(':ask',"L'ajout du médicament est terminé. Voici un récapitulatif, nom du médicament : " + this.attributes.nameMedecine + 
    " dose : " + this.attributes.doseMedecine + this.attributes.typeDoseMedecine+
    " durée : pendant" + this.attributes.numberDurationMedecine + this.attributes.typeDurationMedecine+
    " pour les heures : "+ this.attributes.hoursMedicine.join(","))*/
    this.emit(':ask',"La saisie est terminée")
  }
  
},


  'AddUser': function () {
    var params = {
      Item : {
        "Id" : this.event.session.user.userId,
        "Host" : this.event.host,
        "Port" : this.event.port,
        "UserName" : this.event.user,
        "Key" : this.event.key
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
  /*'AddMedicine': function () {
    var params = {
      Item : {
        "Id" : uuid.v1(),
        "MedecineName" : this.event.name,
        "Quantity": 0
      },
      TableName : 'medicines'
    };
    documentClient.put(params, function(err, data){
      if (err)
        console.log("Error", err, data);
    });
  },*/
    'responseAddMedicine': function () {
      this.emit(':ask',"Quel est le nom du médicament ?")
  },
  'findMedicineByName': function () {
    var params = {
      ExpressionAttributeValues: {
        ':name' : {S: this.event.name}
      },
      FilterExpression: 'contains (MedicineName, :name)',
      TableName : 'medecines'
    };
    documentClient.scan(params, function(err, data){
      if (err){
        console.log("Error", err, data);
      }
      else {
        console.log("Success", data);
        //this.emit(':tell',data)    
      }
    });
    //this.emit(':tell','Medicament ajoutée avec succès !')
  },
  'deleteMedicineByName': function () {
    var params = {
      TableName: 'medecines',
      ExpressionAttributeValues: {
        ':name' : {S: this.event.name}
      }
    };
    documentClient.deleteItem(params, function(err, data){
      if (err){
        console.log("Error", err, data);
      }
      else {
        console.log("Success", data);
        //this.emit(':tell',data)    
      }
    });
    //this.emit(':tell','Medicament ajoutée avec succès !')
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
