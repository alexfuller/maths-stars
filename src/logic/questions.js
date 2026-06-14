/* Question generation — pure logic, no DOM. */

/* ---------- Level definitions ---------- */
export const LEVELS = [
  { id:1, cls:'c-add', icon:'+', title:'Addition', sub:'Numbers under 10', kinds:['add10'] },
  { id:2, cls:'c-add', icon:'+', title:'Addition', sub:'Numbers under 20', kinds:['add20'] },
  { id:3, cls:'c-sub', icon:'−', title:'Subtraction', sub:'Numbers under 10', kinds:['sub10'] },
  { id:4, cls:'c-sub', icon:'−', title:'Subtraction', sub:'Numbers under 20', kinds:['sub20'] },
  { id:5, cls:'c-mul', icon:'×', title:'Multiplication', sub:'Up to 12', kinds:['mul12'] },
  { id:6, cls:'c-div', icon:'÷', title:'Division', sub:'Up to 12', kinds:['div12'] },
  { id:7, cls:'c-mix', icon:'±', title:'Mixed: + and −', sub:'Levels 2 & 4', kinds:['add20','sub20'] },
  { id:8, cls:'c-mix', icon:'⨯', title:'Mixed: × and ÷', sub:'Levels 5 & 6', kinds:['mul12','div12'] },
  { id:9, cls:'c-mix', icon:'∞', title:'Mixed: all', sub:'Levels 2, 4, 5 & 6', kinds:['add20','sub20','mul12','div12'] },
];

export const rnd = (min,max)=> Math.floor(Math.random()*(max-min+1))+min;

/* Build one question {text, answer} for a given kind. */
export function makeQuestion(kind){
  let a,b;
  switch(kind){
    case 'add10': a=rnd(1,9); b=rnd(1,9); return {text:`${a} + ${b}`, answer:a+b};
    case 'add20': a=rnd(1,19); b=rnd(1,19); return {text:`${a} + ${b}`, answer:a+b};
    case 'sub10': a=rnd(1,9); b=rnd(0,a); return {text:`${a} − ${b}`, answer:a-b};
    case 'sub20': a=rnd(1,19); b=rnd(0,a); return {text:`${a} − ${b}`, answer:a-b};
    case 'mul12': a=rnd(1,12); b=rnd(1,12); return {text:`${a} × ${b}`, answer:a*b};
    case 'div12': { const q=rnd(1,12), d=rnd(1,12); return {text:`${d*q} ÷ ${d}`, answer:q}; }
  }
}

export function makeSession(level, n){
  const qs=[];
  for(let i=0;i<n;i++){
    const kind = level.kinds[rnd(0,level.kinds.length-1)];
    qs.push(makeQuestion(kind));
  }
  return qs;
}
