const $ = (id) => document.getElementById(id);
const state = { user:null, view:"landing", authMode:"login", subjects:[], questions:[], quiz:null, answers:{}, index:0, startedAt:0, timerId:null, remaining:0, adminTab:"questions" };
const views = ["landing","auth","dashboard","exam","results","admin","scoreView"];
let toastTimer;
function toast(message) { const el=$("toast"); el.textContent=message; el.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),3500); }
async function api(path, options={}) {
  const response = await fetch(path, { credentials:"same-origin", headers:{ "Content-Type":"application/json", ...(options.headers||{}) }, ...options });
  let data={}; try { data=await response.json(); } catch {}
  if (!response.ok) throw new Error(data.error || `حدث خطأ (${response.status})`);
  return data;
}
function showView(name) {
  state.view=name;
  views.forEach(v=>$(v)?.classList.toggle("hidden",v!==name));
  $("about").classList.toggle("hidden", !["landing","auth"].includes(name));
  window.scrollTo({top:0,behavior:"smooth"});
}
function setAuthMode(mode) {
  state.authMode=mode;
  const reg=mode==="register";
  $("authTitle").textContent=reg?"إنشاء حساب طالب":"تسجيل الدخول";
  $("authSub").textContent=reg?"أدخل بياناتك لإنشاء حساب جديد.":"أدخل بياناتك لمتابعة الاختبارات.";
  $("fullNameField").classList.toggle("hidden",!reg);
  $("fullName").required=reg;
  $("password").autocomplete=reg?"new-password":"current-password";
  $("authSubmit").textContent=reg?"إنشاء الحساب":"دخول";
  $("authSwitch").innerHTML=reg?'لديك حساب بالفعل؟ <button id="switchLogin" type="button">تسجيل الدخول</button>':'ليس لديك حساب؟ <button id="switchRegister" type="button">إنشاء حساب جديد</button>';
  $("switchRegister")?.addEventListener("click",()=>setAuthMode("register"));
  $("switchLogin")?.addEventListener("click",()=>setAuthMode("login"));
  $("authMessage").textContent="";
}
async function handleAuth(e) {
  e.preventDefault();
  const mode=state.authMode, button=$("authSubmit");
  button.disabled=true; button.textContent="يرجى الانتظار...";
  $("authMessage").textContent="";
  try {
    const payload={ username:$("username").value.trim(), password:$("password").value };
    if(mode==="register") payload.fullName=$("fullName").value.trim();
    const data=await api(`/api/auth/${mode}`,{method:"POST",body:JSON.stringify(payload)});
    state.user=data.user;
    $("password").value="";
    await enterApp();
  } catch(err) { $("authMessage").textContent=err.message; }
  finally { button.disabled=false; button.textContent=mode==="register"?"إنشاء الحساب":"دخول"; }
}
async function enterApp() {
  $("nav").classList.remove("hidden");
  $("adminNav").classList.toggle("hidden",state.user?.role!=="admin");
  $("welcomeName").textContent=state.user?.fullName || state.user?.username || "طالبنا";
  await loadDashboard(); showView("dashboard");
}
async function loadDashboard() {
  try {
    const [s,r]=await Promise.all([api("/api/subjects"),api("/api/results")]);
    state.subjects=s.subjects||[];
    const results=r.results||[];
    $("subjectCount").textContent=state.subjects.length;
    $("attemptCount").textContent=results.length;
    $("averageScore").textContent=results.length?`${(results.reduce((n,x)=>n+Number(x.percentage||0),0)/results.length).toFixed(1)}%`:"—";
    $("subjectGrid").innerHTML="";
    if(!state.subjects.length) $("subjectGrid").innerHTML='<div class="empty">لا توجد مواد متاحة حاليًا.</div>';
    state.subjects.forEach((s,i)=>{
      const card=document.createElement("article");card.className="subject-card";
      const symbol=document.createElement("div");symbol.className="subject-symbol";symbol.textContent=["ق","ب","ش","ع"][i%4];card.appendChild(symbol);
      const h=document.createElement("h3");h.textContent=s.name;card.appendChild(h);
      const p=document.createElement("p");p.textContent=s.description||"اختبار تدريبي لهذه المادة.";card.appendChild(p);
      const meta=document.createElement("div");meta.className="subject-meta";meta.textContent=`${s.questionCount} سؤال · ${Math.round(s.duration_seconds/60)} دقيقة`;card.appendChild(meta);
      const btn=document.createElement("button");btn.className="btn primary";btn.textContent="ابدأ الاختبار";btn.disabled=!s.questionCount;btn.onclick=()=>startQuiz(s);card.appendChild(btn);$("subjectGrid").appendChild(card);
    });
  } catch(e) { $("subjectGrid").innerHTML=""; const d=document.createElement("div");d.className="empty";d.textContent=e.message;$("subjectGrid").appendChild(d); }
}
async function startQuiz(subject) {
  if(!confirm(`بدء اختبار مادة "${subject.name}"؟`))return;
  try {
    const data=await api("/api/quiz/start",{method:"POST",body:JSON.stringify({subjectId:subject.id})});
    state.quiz={...data,subjectId:subject.id};state.questions=data.questions;state.answers={};state.index=0;state.startedAt=Date.now();state.remaining=data.durationSeconds;
    $("examSubject").textContent=data.subject.name;renderQuestion();startTimer();showView("exam");
  } catch(e){toast(e.message);}
}
function renderQuestion() {
  const q=state.questions[state.index];if(!q)return;
  $("questionCounter").textContent=`السؤال ${state.index+1} من ${state.questions.length}`;
  $("progressBar").style.width=`${((state.index+1)/state.questions.length)*100}%`;
  const box=$("questionBox");box.innerHTML="";
  const title=document.createElement("h2");title.textContent=q.prompt;box.appendChild(title);
  q.options.forEach((option,i)=>{
    const label=document.createElement("label");label.className="option"+(state.answers[q.id]===i?" selected":"");
    const input=document.createElement("input");input.type="radio";input.name="answer";input.value=i;input.checked=state.answers[q.id]===i;
    input.addEventListener("change",()=>{state.answers[q.id]=i;renderQuestion();});
    const text=document.createElement("span");text.textContent=option;label.append(input,text);box.appendChild(label);
  });
  $("prevQuestion").disabled=state.index===0;
  $("nextQuestion").classList.toggle("hidden",state.index===state.questions.length-1);
  $("submitExam").classList.toggle("hidden",state.index!==state.questions.length-1);
}
function startTimer() {
  clearInterval(state.timerId);
  const end=Date.now()+state.remaining*1000;
  const tick=()=>{
    state.remaining=Math.max(0,Math.ceil((end-Date.now())/1000));
    const m=String(Math.floor(state.remaining/60)).padStart(2,"0"),s=String(state.remaining%60).padStart(2,"0");
    $("timer").textContent=`${m}:${s}`;$("timer").classList.toggle("warning",state.remaining<=60);
    if(state.remaining<=0){clearInterval(state.timerId);submitQuiz(true);}
  };
  tick();state.timerId=setInterval(tick,250);
}
async function submitQuiz(auto=false) {
  if(!state.quiz)return;
  if(!auto&&!confirm("هل تريد تسليم إجاباتك الآن؟"))return;
  clearInterval(state.timerId);$("submitExam").disabled=true;
  try {
    const duration=Math.round((Date.now()-state.startedAt)/1000);
    const data=await api("/api/quiz/submit",{method:"POST",body:JSON.stringify({quizId:state.quiz.quizId,answers:state.answers,durationSeconds:duration})});
    $("scorePercent").textContent=`${data.result.percentage}%`;
    $("scoreDetail").textContent=`أجبت إجابة صحيحة عن ${data.result.score} من ${data.result.total} سؤالًا. ${auto?"انتهى الوقت وتم تسليم الاختبار تلقائيًا.":"تم حفظ نتيجتك."}`;
    state.quiz=null;showView("scoreView");
  } catch(e){toast(e.message);showView("dashboard");}
  finally {$("submitExam").disabled=false;}
}
async function loadResults() {
  const box=$("resultsList");box.innerHTML='<div class="loading">جارٍ تحميل النتائج...</div>';
  try {
    const data=await api("/api/results"),rows=data.results||[];
    if(!rows.length){box.innerHTML='<div class="empty">لم تؤدِّ أي اختبار حتى الآن.</div>';return;}
    const table=document.createElement("table");table.className="data-table";
    table.innerHTML="<thead><tr><th>المادة</th><th>النتيجة</th><th>النسبة</th><th>المدة</th><th>التاريخ</th></tr></thead>";
    const body=document.createElement("tbody");
    rows.forEach(r=>{const tr=document.createElement("tr");[r.subject_name,`${r.score}/${r.total}`,`${r.percentage}%`,`${Math.floor(r.duration_seconds/60)} د`,new Date(r.created_at.replace(" ","T")+"Z").toLocaleString("ar-LY")].forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.appendChild(td);});body.appendChild(tr);});
    table.appendChild(body);box.replaceChildren(table);
  }catch(e){box.textContent=e.message;}
}
async function loadAdminQuestions() {
  const filter=$("filterSubject").value;
  try {
    const data=await api("/api/admin/questions"+(filter?`?subjectId=${encodeURIComponent(filter)}`:""));
    const box=$("questionList");box.innerHTML="";
    if(!data.questions.length){box.innerHTML='<div class="empty">لا توجد أسئلة لهذه المادة.</div>';return;}
    data.questions.forEach(q=>{
      const row=document.createElement("div");row.className="question-row";
      const title=document.createElement("b");title.textContent=q.prompt;row.appendChild(title);
      const small=document.createElement("small");small.textContent=`${q.subject_name} · الإجابة الصحيحة: ${["أ","ب","ج","د"][q.correct_option]}`;row.appendChild(small);
      const btn=document.createElement("button");btn.className="btn danger";btn.textContent="حذف السؤال";btn.onclick=async()=>{if(!confirm("حذف هذا السؤال؟"))return;try{await api("/api/admin/questions",{method:"DELETE",body:JSON.stringify({id:q.id})});toast("تم حذف السؤال");loadAdminQuestions();}catch(e){toast(e.message);}};row.appendChild(btn);box.appendChild(row);
    });
  }catch(e){$("questionList").textContent=e.message;}
}
async function loadAdminUsers() {
  const box=$("usersList");box.innerHTML='<div class="loading">جارٍ تحميل المستخدمين...</div>';
  try {
    const data=await api("/api/admin/users");
    if(!data.users.length){box.textContent="لا يوجد مستخدمون.";return;}
    const table=document.createElement("table");table.className="data-table";
    table.innerHTML="<thead><tr><th>اسم المستخدم</th><th>الاسم الكامل</th><th>الدور</th><th>الحالة</th><th>الاختبارات</th><th>المتوسط</th><th>أفضل نتيجة</th><th>تاريخ التسجيل</th></tr></thead>";
    const body=document.createElement("tbody");
    data.users.forEach(u=>{const tr=document.createElement("tr");[u.username,u.full_name,u.role==="admin"?"مدير":"طالب",u.active?"نشط":"موقوف",u.attempts,`${u.average_percentage}%`,`${u.best_percentage}%`,new Date(u.created_at.replace(" ","T")+"Z").toLocaleDateString("ar-LY")].forEach(v=>{const td=document.createElement("td");td.textContent=String(v);tr.appendChild(td);});body.appendChild(tr);});
    table.appendChild(body);box.replaceChildren(table);
  }catch(e){box.textContent=e.message;}
}
async function loadAdmin() {
  try {
    const data=await api("/api/subjects");state.subjects=data.subjects||[];
    ["qSubject","filterSubject"].forEach(id=>{const sel=$(id);sel.innerHTML="";state.subjects.forEach(s=>{const o=document.createElement("option");o.value=s.id;o.textContent=s.name;sel.appendChild(o);});});
    await loadAdminQuestions();
  }catch(e){toast(e.message);}
}
function showAdminTab(tab) {
  state.adminTab=tab;$("adminQuestions").classList.toggle("hidden",tab!=="questions");$("adminUsers").classList.toggle("hidden",tab!=="users");
  document.querySelectorAll("[data-admin-tab]").forEach(b=>b.classList.toggle("active",b.dataset.adminTab===tab));
  if(tab==="users")loadAdminUsers();
}
async function createQuestion(e) {
  e.preventDefault();
  const payload={subjectId:$("qSubject").value,prompt:$("qPrompt").value.trim(),options:[0,1,2,3].map(i=>$("opt"+i).value.trim()),correctOption:Number($("qCorrect").value),explanation:$("qExplanation").value.trim()};
  try{await api("/api/admin/questions",{method:"POST",body:JSON.stringify(payload)});$("questionForm").reset();$("questionMessage").style.color="green";$("questionMessage").textContent="تم حفظ السؤال.";await loadAdminQuestions();}
  catch(e){$("questionMessage").style.color="var(--red)";$("questionMessage").textContent=e.message;}
}
async function logout() {
  clearInterval(state.timerId);
  try{await api("/api/auth/logout",{method:"POST",body:"{}"});}catch{}
  state.user=null;$("nav").classList.add("hidden");showView("landing");
}
async function init() {
  $("year").textContent=new Date().getFullYear();
  $("showLogin").onclick=()=>{setAuthMode("login");showView("auth");};
  $("showRegister").onclick=()=>{setAuthMode("register");showView("auth");};
  $("backLanding").onclick=()=>showView("landing");
  $("authForm").addEventListener("submit",handleAuth);
  $("logoutBtn").onclick=logout;
  $("brandHome").onclick=e=>{e.preventDefault();state.user?showView("dashboard"):showView("landing");};
  document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",async()=>{const v=b.dataset.view;if(v==="dashboard"){await loadDashboard();showView(v);}else if(v==="results"){await loadResults();showView(v);}else if(v==="admin"){if(state.user?.role!=="admin")return toast("صلاحيات المدير مطلوبة");await loadAdmin();showView(v);}}));
  $("switchRegister").onclick=()=>setAuthMode("register");
  $("prevQuestion").onclick=()=>{if(state.index>0){state.index--;renderQuestion();}};
  $("nextQuestion").onclick=()=>{if(state.index<state.questions.length-1){state.index++;renderQuestion();}};
  $("submitExam").onclick=()=>submitQuiz(false);
  $("exitExam").onclick=()=>{if(confirm("الخروج من الاختبار؟ لن تُحفظ النتيجة.")){clearInterval(state.timerId);state.quiz=null;loadDashboard().then(()=>showView("dashboard"));}};
  $("scoreHome").onclick=()=>loadDashboard().then(()=>showView("dashboard"));
  $("questionForm").addEventListener("submit",createQuestion);
  $("filterSubject").addEventListener("change",loadAdminQuestions);
  document.querySelectorAll("[data-admin-tab]").forEach(b=>b.addEventListener("click",()=>showAdminTab(b.dataset.adminTab)));
  try{const data=await api("/api/auth/me");state.user=data.user;await enterApp();}
  catch{showView("landing");$("nav").classList.add("hidden");}
}
init();
