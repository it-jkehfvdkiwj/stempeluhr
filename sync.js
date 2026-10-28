// Synchronisierung über Firebase (Auth: E-Mail/Passwort, Daten: Firestore users/{uid})
const V='10.12.2', B=`https://www.gstatic.com/firebasejs/${V}/`;
const $=id=>document.getElementById(id);
const api=()=>window.__stempel;
function ui(state,msg){
  $('syncOut').hidden=state!=='out';$('syncIn').hidden=state!=='in';
  $('syncFoot').textContent=msg||'';
}
function toast(t){const el=$('toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2400);}
const ERR={'auth/invalid-email':'Die E-Mail-Adresse ist ungültig.','auth/missing-password':'Bitte ein Passwort eingeben.','auth/weak-password':'Das Passwort braucht mindestens 6 Zeichen.',
  'auth/email-already-in-use':'Für diese E-Mail gibt es schon ein Konto. Melde dich an.','auth/invalid-credential':'E-Mail oder Passwort stimmt nicht.','auth/wrong-password':'E-Mail oder Passwort stimmt nicht.',
  'auth/user-not-found':'E-Mail oder Passwort stimmt nicht.','auth/too-many-requests':'Zu viele Versuche. Warte kurz und probier es dann nochmal.','auth/network-request-failed':'Keine Internetverbindung.',
  'auth/operation-not-allowed':'Konto erstellen ist ausgeschaltet. Melde dich mit deinem bestehenden Konto an.','auth/admin-restricted-operation':'Konto erstellen ist ausgeschaltet. Melde dich mit deinem bestehenden Konto an.'};
const err=e=>ERR[e&&e.code]||('Fehler: '+((e&&e.code)||e));

(async function(){
  const cfg=window.FIREBASE_CONFIG;
  if(!cfg||!cfg.apiKey){ui('none','Die Synchronisierung ist noch nicht eingerichtet.');$('syncGroup').hidden=true;return;}
  let fa,ff,app;
  try{
    const [a,au,fs]=await Promise.all([import(B+'firebase-app.js'),import(B+'firebase-auth.js'),import(B+'firebase-firestore.js')]);
    fa=au;ff=fs;app=a.initializeApp(cfg);
  }catch(e){ui('none','Synchronisierung gerade nicht erreichbar. Deine Einträge werden lokal gespeichert.');$('syncGroup').hidden=true;return;}
  $('syncGroup').hidden=false;
  const auth=fa.getAuth(app);
  let db;try{db=ff.initializeFirestore(app,{localCache:ff.persistentLocalCache()});}catch(e){db=ff.getFirestore(app);}
  let unsubs=[];

  async function connect(user){
    const st=api();if(!st)return;
    const uref=ff.doc(db,'users',user.uid), col=ff.collection(db,'users',user.uid,'entries');
    ui('in','Wird synchronisiert …');$('syncWho').textContent=user.email||'';
    try{
      const [snap,es]=await Promise.all([ff.getDoc(uref),ff.getDocs(col)]);
      const remote=new Set(es.docs.map(d=>d.id));
      const local=Object.values(st.S.entries).filter(e=>!remote.has(e.id));
      for(let i=0;i<local.length;i+=400){const b=ff.writeBatch(db);local.slice(i,i+400).forEach(e=>b.set(ff.doc(col,e.id),e));await b.commit();}
      if(!snap.exists())await ff.setDoc(uref,{settings:st.S.settings,active:st.S.active});
    }catch(e){console.warn(e);ui('in','Erster Abgleich fehlgeschlagen: '+err(e));}
    st.setBackend({set:d=>ff.setDoc(uref,d)},{doc:id=>({set:d=>ff.setDoc(ff.doc(col,id),d),delete:()=>ff.deleteDoc(ff.doc(col,id))})},user.email);
    unsubs.push(ff.onSnapshot(uref,s=>{if(!s.exists())return;const d=s.data();st.applyState(d.settings,d.active===undefined?null:d.active);},e=>console.warn(e)));
    unsubs.push(ff.onSnapshot(col,qs=>{const m={};qs.docs.forEach(d=>{m[d.id]=Object.assign({},d.data(),{id:d.id});});st.replaceEntries(m);
      ui('in','Synchronisiert. Änderungen erscheinen sofort auf allen Geräten, auf denen du angemeldet bist.');},e=>{console.warn(e);ui('in','Synchronisierung unterbrochen: '+err(e));}));
  }
  function disconnect(){unsubs.forEach(u=>u());unsubs=[];const st=api();if(st)st.setBackend(null,null,null);}

  fa.onAuthStateChanged(auth,u=>{disconnect();if(u)connect(u);else ui('out','Melde dich auf iPhone und Laptop mit demselben Konto an. Deine Einträge auf diesem Gerät werden beim ersten Anmelden hochgeladen.');});

  const creds=()=>[$('syncEmail').value.trim(),$('syncPw').value];
  async function run(btn,fn){btn.disabled=true;try{await fn();$('syncPw').value='';}catch(e){toast(err(e));}finally{btn.disabled=false;}}
  $('syncLogin').onclick=()=>run($('syncLogin'),()=>fa.signInWithEmailAndPassword(auth,...creds()));
  $('syncSignup').onclick=()=>run($('syncSignup'),()=>fa.createUserWithEmailAndPassword(auth,...creds()));
  $('syncReset').onclick=()=>run($('syncReset'),async()=>{const [m]=creds();if(!m){toast('Trag zuerst deine E-Mail ein.');return;}await fa.sendPasswordResetEmail(auth,m);toast('E-Mail zum Zurücksetzen verschickt');});
  let outArm=false;
  $('syncLogout').onclick=async()=>{if(!outArm){outArm=true;$('syncLogoutLbl').textContent='Nochmal tippen zum Abmelden';setTimeout(()=>{outArm=false;$('syncLogoutLbl').textContent='Abmelden';},4000);return;}
    outArm=false;$('syncLogoutLbl').textContent='Abmelden';await fa.signOut(auth);toast('Abgemeldet. Die Einträge bleiben auf diesem Gerät.');};
})();
