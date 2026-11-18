import { useEffect, useMemo, useState } from 'react'
import {
  Apple, BatteryMedium, Bluetooth, CircleCheck, Clock3,
  Flame, Home, Leaf, Plus, Snowflake, Thermometer, Trash2,
  Utensils, X, CalendarDays, Container as ContainerIcon, Pencil,
  Droplets, Dumbbell, Salad, Settings2
} from 'lucide-react'

type Status = 'idle' | 'heating' | 'cooling' | 'offline'
type Container = {
  id: string; name: string; size: string; owner: string; mealId: string | null;
  battery: number; temperature: number; target: number; status: Status; ready: boolean
}
type Ingredient = { name: string; grams: number }
type Meal = {
  id: string; name: string; ingredients: Ingredient[]; servings: number; cooked: string;
  eatBy: string; containerId: string | null; eatingDate: string | null; eatingTime: string;
  category: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'; notes: string; reminder: boolean;
  eaten?: boolean; eatenAt?: string
}
type Preferences = {
  owner: string; dietary: string[]; avoid: string; notifications: boolean
}
type Tab = 'home' | 'containers' | 'planner' | 'nutrition'

const ingredientDb = [
  { name: 'Cooked salmon', calories: 206, protein: 22, carbs: 0, fat: 12 },
  { name: 'White rice', calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { name: 'Broccoli', calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4 },
  { name: 'Edamame', calories: 121, protein: 12, carbs: 9, fat: 5 },
  { name: 'Chicken breast', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: 'Pasta', calories: 131, protein: 5, carbs: 25, fat: 1.1 },
  { name: 'Tomato sauce', calories: 60, protein: 1.6, carbs: 10, fat: 1.5 },
  { name: 'Egg', calories: 143, protein: 13, carbs: 1.1, fat: 9.5 },
  { name: 'Black beans', calories: 132, protein: 8.9, carbs: 23.7, fat: 0.5 },
  { name: 'Tortilla', calories: 305, protein: 8, carbs: 49, fat: 9 },
  { name: 'Cheddar cheese', calories: 403, protein: 25, carbs: 1.3, fat: 33 },
]

const iso = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

const seedState = () => ({
  containers: [
    { id:'c1', name:'Container 1', size:'Medium · 900 ml', owner:'Kenzie', mealId:'m1', battery:78, temperature:4, target:55, status:'cooling' as Status, ready:true },
    { id:'c2', name:'Container 2', size:'Large · 1200 ml', owner:'Kenzie', mealId:'m2', battery:54, temperature:72, target:72, status:'idle' as Status, ready:false },
    { id:'c3', name:'Container 3', size:'Small · 600 ml', owner:'Sam', mealId:null, battery:91, temperature:20, target:20, status:'offline' as Status, ready:false },
  ] as Container[],
  meals: [
    { id:'m1', name:'Teriyaki salmon bowl', ingredients:[{name:'Cooked salmon',grams:180},{name:'White rice',grams:200},{name:'Broccoli',grams:120},{name:'Edamame',grams:80}], servings:1, cooked:iso(0), eatBy:iso(2), containerId:'c1', eatingDate:iso(0), eatingTime:'12:30', category:'Lunch', notes:'Add extra sesame seeds.', reminder:true },
    { id:'m2', name:'Breakfast burrito', ingredients:[{name:'Egg',grams:120},{name:'Black beans',grams:100},{name:'Tortilla',grams:70},{name:'Cheddar cheese',grams:30}], servings:1, cooked:iso(-1), eatBy:iso(1), containerId:'c2', eatingDate:iso(1), eatingTime:'08:15', category:'Breakfast', notes:'', reminder:true },
    { id:'m3', name:'Creamy tomato pasta', ingredients:[{name:'Pasta',grams:180},{name:'Tomato sauce',grams:160},{name:'Chicken breast',grams:140}], servings:2, cooked:iso(-2), eatBy:iso(0), containerId:null, eatingDate:iso(2), eatingTime:'18:30', category:'Dinner', notes:'Fridge section B.', reminder:false },
    { id:'m4', name:'Roasted vegetable couscous', ingredients:[{name:'Broccoli',grams:180},{name:'White rice',grams:140},{name:'Edamame',grams:100}], servings:1, cooked:iso(-1), eatBy:iso(1), containerId:null, eatingDate:iso(1), eatingTime:'18:00', category:'Dinner', notes:'Keep chilled until reheating.', reminder:true },
  ] as Meal[],
  preferences: { owner:'Kenzie', dietary:['Balanced'], avoid:'', notifications:true } as Preferences,
  history: [] as Meal[],
})

function useStored<T>(key: string, initial: T) {
  const [value,setValue] = useState<T>(() => {
    try { const saved=localStorage.getItem(key); return saved ? JSON.parse(saved) : initial } catch { return initial }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)) }, [key,value])
  return [value,setValue] as const
}

const formatTime = (time:string) => {
  if (!time) return ''
  const [h,m] = time.split(':').map(Number)
  return `${h%12 || 12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`
}
const formatDate = (date:string, options?:Intl.DateTimeFormatOptions) =>
  date ? new Date(date+'T12:00:00').toLocaleDateString(undefined, options || {month:'short',day:'numeric'}) : ''

export default function App() {
  const seed = useMemo(() => seedState(), [])
  const [containers,setContainers] = useStored('prep.containers',seed.containers)
  const [meals,setMeals] = useStored('prep.meals',seed.meals)
  const [preferences,setPreferences] = useStored('prep.preferences',seed.preferences)
  const [,setHistory] = useStored('prep.history',seed.history)
  const [tab,setTab] = useState<Tab>('home')
  const [toast,setToast] = useState('')
  const [modal,setModal] = useState<'meal'|'pair'|'preferences'|'schedule'|null>(null)
  const [editingMeal,setEditingMeal] = useState<Meal|null>(null)
  const [detailId,setDetailId] = useState<string|null>(null)
  const [selectedDay,setSelectedDay] = useState(iso(0))

  const notify = (message:string) => { setToast(message); window.setTimeout(() => setToast(''),2600) }

  useEffect(() => {
    const openPreferences=()=>setModal('preferences')
    window.addEventListener('open-preferences',openPreferences)
    return ()=>window.removeEventListener('open-preferences',openPreferences)
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setContainers(current => current.map(c => {
        if (c.status === 'offline' || c.status === 'idle') return c
        const step = c.status === 'heating' ? 1 : -1
        const next = c.temperature + step
        if ((c.status === 'heating' && next >= c.target) || (c.status === 'cooling' && next <= c.target)) {
          return {...c, temperature:c.target, status:'idle'}
        }
        return {...c, temperature:next}
      }))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [setContainers])

  const resetDemo = () => {
    const fresh=seedState()
    setContainers(fresh.containers); setMeals(fresh.meals); setPreferences(fresh.preferences); setHistory([])
    setModal(null); notify('Demo reset')
  }

  const openMeal = (meal:Meal) => { setEditingMeal(meal); setModal('meal') }
  const newMeal = () => { setEditingMeal(null); setModal('meal') }
  const markEaten = (meal:Meal) => {
    setHistory(h=>[{...meal,eaten:true,eatenAt:new Date().toISOString()},...h])
    setMeals(ms=>ms.filter(m=>m.id!==meal.id))
    setContainers(cs=>cs.map(c=>c.mealId===meal.id?{...c,mealId:null,status:'idle'}:c))
    setDetailId(null); notify(`${meal.name} moved to meal history`)
  }

  const assignMeal = (mealId:string, containerId:string|null) => {
    const meal=meals.find(m=>m.id===mealId)
    if (!meal) return
    if (containerId) {
      const occupied=containers.find(c=>c.id===containerId && c.mealId && c.mealId!==mealId)
      const occupiedMeal=occupied ? meals.find(m=>m.id===occupied.mealId) : null
      if (occupiedMeal && !window.confirm(`Replace ${occupiedMeal.name} in ${occupied?.name}?`)) return
    }
    setMeals(ms=>ms.map(m=>m.id===mealId?{...m,containerId}:m))
    setContainers(cs=>cs.map(c=>{
      if (c.mealId===mealId) c={...c,mealId:null,status:'idle'}
      if (c.id===containerId) c={...c,mealId,status:c.status==='offline'?'offline':'idle'}
      return c
    }))
  }

  return (
    <div className="app-shell">
      <main className="phone-frame">
        {tab==='home' && <HomeScreen meals={meals} containers={containers} preferences={preferences} onMeal={openMeal} onAdd={newMeal} onPair={()=>setModal('pair')} onContainer={setDetailId} onNotify={notify} />}
        {tab==='containers' && <ContainersScreen containers={containers} meals={meals} onDetail={setDetailId} onPair={()=>setModal('pair')} onAssign={assignMeal} onRename={(id,name)=>{setContainers(cs=>cs.map(c=>c.id===id?{...c,name}:c));notify('Container renamed')}} onOwner={(id,owner)=>{setContainers(cs=>cs.map(c=>c.id===id?{...c,owner}:c));notify('Owner updated')}} />}
        {tab==='planner' && <PlannerScreen meals={meals} containers={containers} selectedDay={selectedDay} setSelectedDay={setSelectedDay} onEdit={openMeal} onAdd={newMeal} onSchedule={(meal)=>{setEditingMeal(meal);setModal('schedule')}} onRemoveSchedule={(meal)=>{setMeals(ms=>ms.map(m=>m.id===meal.id?{...m,eatingDate:null}:m));notify('Removed from planner')}} />}
        {tab==='nutrition' && <NutritionScreen meals={meals} selectedDay={selectedDay} preferences={preferences} />}
      </main>

      {detailId && <ContainerDetail id={detailId} containers={containers} meals={meals} onClose={()=>setDetailId(null)} onUpdate={(id,patch)=>setContainers(cs=>cs.map(c=>c.id===id?{...c,...patch}:c))} onMeal={openMeal} onMarkEaten={markEaten} />}
      {modal==='meal' && <MealModal meal={editingMeal} meals={meals} containers={containers} onClose={()=>setModal(null)} onSave={(meal)=>{
        if (editingMeal) setMeals(ms=>ms.map(m=>m.id===meal.id?meal:m))
        else setMeals(ms=>[meal,...ms])
        if (meal.containerId) assignMeal(meal.id,meal.containerId)
        setModal(null); notify(editingMeal?'Meal updated':'Meal added')
      }} onDelete={(id)=>{setMeals(ms=>ms.filter(m=>m.id!==id));setContainers(cs=>cs.map(c=>c.mealId===id?{...c,mealId:null,status:'idle'}:c));setModal(null);notify('Meal deleted')}} />}
      {modal==='pair' && <PairModal onClose={()=>setModal(null)} onPair={(name,size,owner)=>{
        setContainers(cs=>[...cs,{id:'c'+Date.now(),name,size,owner,mealId:null,battery:100,temperature:20,target:20,status:'idle',ready:false}]);setModal(null);notify('Container paired')
      }} />}
      {modal==='preferences' && <PreferencesModal preferences={preferences} onClose={()=>setModal(null)} onSave={(p)=>{setPreferences(p);setModal(null);notify('Preferences saved')}} onReset={resetDemo} />}
      {modal==='schedule' && editingMeal && <ScheduleModal meal={editingMeal} onClose={()=>setModal(null)} onSave={(date,time,category)=>{
        setMeals(ms=>ms.map(m=>m.id===editingMeal.id?{...m,eatingDate:date,eatingTime:time,category}:m));setModal(null);notify('Meal scheduled')
      }} />}

      {toast && <div className="toast" role="status">{toast}</div>}

      <nav className="bottom-nav" aria-label="Primary navigation">
        {[
          ['home','Home',Home],['containers','Containers',ContainerIcon],['planner','Planner',CalendarDays],['nutrition','Nutrition',Apple]
        ].map(([key,label,Icon]) => (
          <button key={String(key)} className={`nav-button ${tab===key?'active':''}`} onClick={()=>setTab(key as Tab)} aria-current={tab===key?'page':undefined}>
            {(() => { const I=Icon as typeof Home; return <I size={20}/> })()}<span>{String(label)}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function HomeScreen({meals,containers,preferences,onMeal,onAdd,onPair,onContainer,onNotify}:{meals:Meal[];containers:Container[];preferences:Preferences;onMeal:(m:Meal)=>void;onAdd:()=>void;onPair:()=>void;onContainer:(id:string)=>void;onNotify:(m:string)=>void}) {
  const upcoming=[...meals].filter(m=>m.eatingDate&&!m.eaten).sort((a,b)=>`${a.eatingDate}${a.eatingTime}`.localeCompare(`${b.eatingDate}${b.eatingTime}`))[0]
  const container=upcoming?containers.find(c=>c.id===upcoming.containerId):undefined
  return <div className="content">
    <div className="topbar">
      <div><div className="eyebrow">{new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</div></div>
      <button className="icon-button avatar" aria-label="Open preferences" onClick={()=>window.dispatchEvent(new CustomEvent('open-preferences'))}>{preferences.owner.slice(0,1).toUpperCase()}</button>
    </div>
    <div style={{marginBottom:18}}>
      <div className="eyebrow">Good morning</div>
      <h1 className="screen-title">Next meal</h1>
    </div>
    {upcoming ? <article className="card sage-card" style={{width:'100%',textAlign:'left',padding:20,border:'0',cursor:'pointer'}} onClick={()=>onMeal(upcoming)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')onMeal(upcoming)}} role="button" tabIndex={0}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
        <span className="pill"><span className="status-dot"/>Connected</span>
        <span style={{fontSize:12,letterSpacing:1,fontWeight:800}}>{container?.name || 'No container'} · {container?.owner || preferences.owner}</span>
      </div>
      <div className="eyebrow" style={{color:'#dce9e3'}}>{upcoming.category}'s meal</div>
      <h2 style={{fontSize:21,margin:'5px 0 3px'}}>{upcoming.name}</h2>
      <div style={{display:'flex',alignItems:'center',gap:7,color:'#e5eee9',fontSize:13}}><Clock3 size={15}/> Ready at {formatTime(upcoming.eatingTime)}</div>
      <div style={{marginTop:18,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div><div className="eyebrow" style={{color:'#dce9e3'}}>Temperature</div><b>{container ? `${container.temperature}°C` : 'No container'}</b></div>
        {container && <button className="secondary-button" onClick={(e)=>{e.stopPropagation();onContainer(container.id)}}><Flame size={17}/> View container</button>}
      </div>
    </article> : <div className="card empty-state">No scheduled meals yet.</div>}

    <div className="section-heading"><h2>Today’s reminders</h2></div>
    {[
      {title:'Remember to pack your lunch',time:'Before 11:45 AM',icon:<CircleCheck size={22}/>,message:'Lunch packing reminder checked off'},
      {title:'Start heating Teriyaki salmon bowl',time:'Today at 12:05 PM',icon:<Flame size={22}/>,message:'Heating reminder scheduled'},
      {title:'Pick up breakfast from the fridge',time:'Tomorrow at 7:45 AM',icon:<ContainerIcon size={22}/>,message:'Breakfast reminder checked off'},
    ].map(reminder=><button key={reminder.title} className="card reminder-card" onClick={()=>onNotify(reminder.message)}>
      <div className="reminder-icon">{reminder.icon}</div>
      <div><b>{reminder.title}</b><div className="muted">{reminder.time}</div></div>
    </button>)}

    <div className="section-heading"><h2>Approaching eat-by</h2></div>
    {meals.filter(m=>m.eatBy<=iso(1)&&!m.eaten).slice(0,5).map(m=>(
      <button key={m.id} className="card meal-card" style={{width:'100%',textAlign:'left'}} onClick={()=>onMeal(m)}>
        <div className="meal-row"><span className="meal-icon"><Utensils size={20}/></span><div style={{flex:1}}><b>{m.name}</b><div className="muted" style={{fontSize:12}}>Eat by {formatDate(m.eatBy,{weekday:'short',month:'short',day:'numeric'})}</div></div><span className="muted">›</span></div>
      </button>
    ))}
    <div className="section-heading"><h2>Quick actions</h2></div>
    <div className="quick-grid">
      <button className="lime-card card" onClick={onAdd}><Plus size={20}/> Add a meal</button>
      <button className="card secondary-button" onClick={onPair}><Bluetooth size={20}/> Connect</button>
    </div>
  </div>
}

function ContainersScreen({containers,meals,onDetail,onPair,onAssign,onRename,onOwner}:{containers:Container[];meals:Meal[];onDetail:(id:string)=>void;onPair:()=>void;onAssign:(m:string,c:string|null)=>void;onRename:(id:string,name:string)=>void;onOwner:(id:string,owner:string)=>void}) {
  return <div className="content">
    <div className="topbar"><h1 className="screen-title">Containers</h1><button className="icon-button" onClick={onPair} aria-label="Pair container"><Plus/></button></div>
    <div className="eyebrow">{containers.filter(c=>c.status!=='offline').length} connected · 1 offline</div>
    {containers.map(c=>{
      const meal=meals.find(m=>m.id===c.mealId)
      return <article className="card meal-card" key={c.id}>
        <button onClick={()=>onDetail(c.id)} style={{width:'100%',border:0,background:'transparent',textAlign:'left',color:'inherit',padding:0}}>
          <div className="meal-row">
            <span className="meal-icon"><ContainerIcon size={22}/></span>
            <div style={{flex:1}}><b>{c.name}</b><div className="muted" style={{fontSize:12}}>{c.size} · {c.owner}</div></div>
            <span className="pill" style={{background:'#edf1e8',color:'#526159'}}>{c.status}</span>
          </div>
        </button>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:14}}>
          <span><BatteryMedium size={15} style={{verticalAlign:'middle'}}/> {c.battery}%</span>
          <span><Thermometer size={15} style={{verticalAlign:'middle'}}/> {c.temperature}°C</span>
        </div>
        <div className="muted" style={{fontSize:13,margin:'10px 0'}}>{meal?`Assigned: ${meal.name}`:'No meal assigned'}</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button className="ghost-button" onClick={()=>onRename(c.id,prompt('Container name',c.name)?.trim()||c.name)}><Pencil size={15}/> Rename</button>
          <button className="ghost-button" onClick={()=>onOwner(c.id,prompt('Owner name',c.owner)?.trim()||c.owner)}>Change owner</button>
          {meal ? <button className="ghost-button" onClick={()=>onAssign(meal.id,null)}>Remove meal</button> : <AssignmentPicker container={c} meals={meals} onAssign={onAssign}/>}
        </div>
      </article>
    })}
  </div>
}

function AssignmentPicker({container,meals,onAssign}:{container:Container;meals:Meal[];onAssign:(m:string,c:string|null)=>void}) {
  const [open,setOpen]=useState(false)
  const options=meals.filter(m=>m.eatingDate&&!m.eaten)
  return <div className="assignment-picker">
    <button className="assignment-trigger" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label={`Assign meal to ${container.name}`}>
      <Plus size={16}/> Assign meal
    </button>
    {open&&<div className="assignment-menu" role="menu">
      {options.length ? options.map(meal=><button key={meal.id} role="menuitem" onClick={()=>{onAssign(meal.id,container.id);setOpen(false)}}>
        <span className="assignment-meal-icon"><Utensils size={15}/></span>
        <span><b>{meal.name}</b><small>{meal.category} · {formatTime(meal.eatingTime)}</small></span>
      </button>) : <p>No unscheduled meals available.</p>}
    </div>}
  </div>
}

function ContainerDetail({id,containers,meals,onClose,onUpdate,onMeal,onMarkEaten}:{id:string;containers:Container[];meals:Meal[];onClose:()=>void;onUpdate:(id:string,patch:Partial<Container>)=>void;onMeal:(m:Meal)=>void;onMarkEaten:(m:Meal)=>void}) {
  const c=containers.find(x=>x.id===id)
  if (!c) return null
  const meal=meals.find(m=>m.id===c.mealId)
  const setMode=(status:'heating'|'cooling')=>onUpdate(c.id,{status,target:status==='heating'?55:4,temperature:c.temperature})
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${c.name} controls`}>
    <section className="modal">
      <div className="modal-header"><button className="icon-button" onClick={onClose} aria-label="Back"><X/></button><b>{c.name}</b><span className="muted" style={{fontSize:12}}>{c.status}</span></div>
      <div className="container-preview">
        <div style={{position:'relative',zIndex:1}}><div className="eyebrow" style={{color:'#bcd0c7'}}>Owner</div><b>{c.owner}</b><h2 style={{margin:'14px 0 4px'}}>{meal?.name || 'Empty container'}</h2><div style={{fontSize:12,color:'#cbd9d3'}}>Eat by {meal?formatDate(meal.eatBy,{month:'short',day:'numeric'}):'—'}</div><div style={{fontSize:40,fontWeight:800,marginTop:18}}>{c.temperature}°C</div></div>
      </div>
      <div className="card meal-card" style={{marginTop:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><b>Target temperature</b><b>{c.target}°C</b></div>
        <div className="temp-control" style={{margin:'12px 0'}}><button aria-label="Decrease target" onClick={()=>onUpdate(c.id,{target:Math.max(-10,c.target-1)})}>−</button><div><Thermometer size={18} style={{display:'inline'}}/> Demo setting</div><button aria-label="Increase target" onClick={()=>onUpdate(c.id,{target:Math.min(90,c.target+1)})}>+</button></div>
        <div className="segmented">
          <button className={c.status==='heating'?'active':''} onClick={()=>setMode('heating')}><Flame size={16}/> Heat</button>
          <button className={c.status==='cooling'?'active':''} onClick={()=>setMode('cooling')}><Snowflake size={16}/> Cool</button>
          <button onClick={()=>onUpdate(c.id,{status:'idle'})}>Stop</button>
        </div>
      </div>
      <div className="card meal-card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><b>Ready for scheduled time</b><div className="muted" style={{fontSize:12}}>Simulated timing</div></div><button className={`toggle ${c.ready?'on':''}`} aria-label="Toggle ready for scheduled time" onClick={()=>onUpdate(c.id,{ready:!c.ready})}><span/></button></div>
        <div className="muted" style={{fontSize:12,marginTop:12}}><BatteryMedium size={14} style={{verticalAlign:'middle'}}/> {c.battery}% battery · <Bluetooth size={14} style={{verticalAlign:'middle'}}/> Simulated connection</div>
      </div>
      {meal && <div className="quick-grid"><button className="secondary-button" onClick={()=>onMeal(meal)}><Pencil size={16}/> Edit meal</button><button className="lime-card card" onClick={()=>onMarkEaten(meal)}><CircleCheck size={16}/> Mark eaten</button></div>}
      <p className="muted" style={{fontSize:11,margin:'14px 4px'}}>Temperature controls are demos, not validated food safety guidance.</p>
    </section>
  </div>
}

function MealModal({meal,meals,containers,onClose,onSave,onDelete}:{meal:Meal|null;meals:Meal[];containers:Container[];onClose:()=>void;onSave:(m:Meal)=>void;onDelete:(id:string)=>void}) {
  const [name,setName]=useState(meal?.name||'')
  const [ingredients,setIngredients]=useState<Ingredient[]>(meal?.ingredients||[])
  const [servings,setServings]=useState(meal?.servings||1)
  const [cooked,setCooked]=useState(meal?.cooked||iso(0))
  const [eatBy,setEatBy]=useState(meal?.eatBy||iso(3))
  const [containerId,setContainerId]=useState(meal?.containerId||'')
  const [date,setDate]=useState(meal?.eatingDate||iso(0))
  const [time,setTime]=useState(meal?.eatingTime||'12:30')
  const [category,setCategory]=useState<Meal['category']>(meal?.category||'Lunch')
  const [notes,setNotes]=useState(meal?.notes||'')
  const [reminder,setReminder]=useState(meal?.reminder||false)
  const [search,setSearch]=useState('')
  const [error,setError]=useState('')

  const save=()=>{
    if(!name.trim()) return setError('Meal name is required.')
    if(servings<1) return setError('At least one serving is required.')
    if(!cooked||!eatBy||eatBy<cooked) return setError('Eat-by date must be on or after the cooked date.')
    if(!date||!time) return setError('Planned eating date and time are required.')
    if(containerId){
      const occupied=containers.find(c=>c.id===containerId&&c.mealId&&c.mealId!==meal?.id)
      const existing=occupied?meals.find(m=>m.id===occupied.mealId):null
      if(existing&&!window.confirm(`Replace ${existing.name} in ${occupied?.name}?`)) return
    }
    onSave({
      id:meal?.id||'m'+Date.now(),name:name.trim(),ingredients,servings,cooked,eatBy,
      containerId:containerId||null,eatingDate:date,eatingTime:time,category,notes,reminder
    })
  }

  const matches=ingredientDb.filter(i=>i.name.toLowerCase().includes(search.toLowerCase())).slice(0,5)
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={meal?'Edit meal':'Add meal'}>
    <section className="modal meal-modal">
      <div className="modal-header"><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button><b>{meal?'Edit meal':'Add a meal'}</b><button className="ghost-button" onClick={save}>Save</button></div>
      {error&&<div className="error" role="alert">{error}</div>}
      <div className="field"><label htmlFor="meal-name">Meal name</label><input id="meal-name" value={name} onChange={e=>setName(e.target.value)} placeholder="Lemon chicken and rice"/></div>
      <div className="field"><label htmlFor="ingredient-search">Ingredients · search local database</label><input id="ingredient-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ingredients"/></div>
      {search&&matches.map(item=><button key={item.name} className="card" style={{width:'100%',padding:'9px 12px',marginBottom:6,textAlign:'left',border:'1px solid #ecece4'}} onClick={()=>{if(!ingredients.some(i=>i.name===item.name))setIngredients(v=>[...v,{name:item.name,grams:100}]);setSearch('')}}><b>{item.name}</b><span className="muted" style={{float:'right',fontSize:12}}>{item.calories} kcal / 100g</span></button>)}
      {ingredients.map((item,i)=><div className="ingredient-edit-row" key={item.name}>
        <button className="ingredient-remove" aria-label={`Remove ${item.name}`} onClick={()=>setIngredients(v=>v.filter((_,j)=>j!==i))}><X size={16}/></button>
        <div className="ingredient-name"><label>{item.name}</label></div>
        <div className="ingredient-grams"><input aria-label={`${item.name} grams`} type="number" min="1" value={item.grams} onChange={e=>setIngredients(v=>v.map((x,j)=>j===i?{...x,grams:Number(e.target.value)}:x))}/><span>g</span></div>
      </div>)}
      <div className="ingredient-row">
        <div className="field"><label htmlFor="servings">Servings</label><input id="servings" type="number" min="1" value={servings} onChange={e=>setServings(Number(e.target.value))}/></div>
        <div className="field"><label htmlFor="category">Meal type</label><select id="category" value={category} onChange={e=>setCategory(e.target.value as Meal['category'])}><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select></div>
      </div>
      <div className="ingredient-row">
        <div className="field"><label htmlFor="cooked">Date cooked</label><input id="cooked" type="date" value={cooked} onChange={e=>setCooked(e.target.value)}/></div>
        <div className="field"><label htmlFor="eat-by">Eat by</label><input id="eat-by" type="date" value={eatBy} onChange={e=>setEatBy(e.target.value)}/></div>
      </div>
      <div className="field"><label htmlFor="container">Assigned container</label><select id="container" value={containerId} onChange={e=>setContainerId(e.target.value)}><option value="">No container</option>{containers.map(c=><option key={c.id} value={c.id}>{c.name} · {c.owner}</option>)}</select></div>
      <div className="ingredient-row">
        <div className="field"><label htmlFor="eating-date">Eating date</label><input id="eating-date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
        <div className="field"><label htmlFor="eating-time">Eating time</label><input id="eating-time" type="time" value={time} onChange={e=>setTime(e.target.value)}/></div>
      </div>
      <div className="field"><label htmlFor="notes">Notes</label><textarea id="notes" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional packing or reheating notes"/></div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'4px 0 18px'}}><b>Meal reminder</b><button className={`toggle ${reminder?'on':''}`} aria-label="Toggle meal reminder" onClick={()=>setReminder(v=>!v)}><span/></button></div>
      {meal&&<button className="secondary-button" style={{width:'100%',color:'#a33f32',marginBottom:8}} onClick={()=>onDelete(meal.id)}><Trash2 size={16}/> Delete meal</button>}
      <button className="primary-button" style={{width:'100%'}} onClick={save}>{meal?'Save changes':'Add meal'}</button>
    </section>
  </div>
}

function PairModal({onClose,onPair}:{onClose:()=>void;onPair:(name:string,size:string,owner:string)=>void}) {
  const [step,setStep]=useState(1)
  const [name,setName]=useState('Container 4')
  const [size,setSize]=useState('Medium · 900 ml')
  const [owner,setOwner]=useState('Kenzie')
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Pair container">
    <section className="modal">
      <div className="modal-header"><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button><b>{step===1?'Find container':'Container details'}</b><span className="muted" style={{fontSize:12}}>Simulated</span></div>
      {step===1?<div className="empty-state"><Bluetooth size={44} style={{margin:'0 auto 12px'}}/><h2>Prep Container 4</h2><p>Hold the container button to start simulated pairing.</p><button className="primary-button" style={{margin:'18px auto 0'}} onClick={()=>setStep(2)}>Pair this container</button></div>:<>
        <div className="field"><label htmlFor="pair-name">Container name</label><input id="pair-name" value={name} onChange={e=>setName(e.target.value)}/></div>
        <div className="field"><label htmlFor="pair-size">Size</label><select id="pair-size" value={size} onChange={e=>setSize(e.target.value)}><option>Small · 600 ml</option><option>Medium · 900 ml</option><option>Large · 1200 ml</option></select></div>
        <div className="field"><label htmlFor="pair-owner">Owner</label><input id="pair-owner" value={owner} onChange={e=>setOwner(e.target.value)}/></div>
        <button className="primary-button" style={{width:'100%'}} disabled={!name.trim()||!owner.trim()} onClick={()=>onPair(name.trim(),size,owner.trim())}>Connect container</button>
        {!name.trim()&&<p className="error" style={{marginTop:8}}>Container name and owner are required.</p>}
      </>}
    </section>
  </div>
}

function PlannerScreen({meals,containers,selectedDay,setSelectedDay,onEdit,onAdd,onSchedule,onRemoveSchedule}:{meals:Meal[];containers:Container[];selectedDay:string;setSelectedDay:(d:string)=>void;onEdit:(m:Meal)=>void;onAdd:()=>void;onSchedule:(m:Meal)=>void;onRemoveSchedule:(m:Meal)=>void}) {
  const days=useMemo(()=>Array.from({length:7},(_,i)=>iso(i)),[])
  const scheduled=meals.filter(m=>m.eatingDate===selectedDay&&!m.eaten)
  const categories=['Breakfast','Lunch','Dinner','Snack'] as const
  return <div className="content">
    <div className="topbar"><h1 className="screen-title">Meal planner</h1></div>
    <div className="planner-date"><span>{new Date(selectedDay+'T12:00:00').toLocaleDateString(undefined,{weekday:'long'})}</span><b>{new Date(selectedDay+'T12:00:00').toLocaleDateString(undefined,{month:'long',day:'numeric'})}</b></div>
    <div className="planner-grid">{days.map(d=>{const date=new Date(d+'T12:00:00');return <button key={d} className={`day-button ${selectedDay===d?'active':''}`} onClick={()=>setSelectedDay(d)}><div style={{fontSize:10,textTransform:'uppercase',fontWeight:800}}>{date.toLocaleDateString(undefined,{weekday:'short'}).slice(0,2)}</div><b>{date.getDate()}</b></button>})}</div>
    {categories.map(category=>{
      const items=scheduled.filter(m=>m.category===category)
      return <section className="planner-section" key={category}>
        <div className="planner-section-heading"><h2>{category}</h2></div>
        {items.length?items.map(m=>{
          const c=containers.find(x=>x.id===m.containerId)
          return <div className="schedule-row" key={m.id}><time>{formatTime(m.eatingTime).replace(' ',' ')}</time><article className="card planner-meal" style={{margin:0}}>
            <button onClick={()=>onEdit(m)} style={{width:'100%',border:0,background:'transparent',textAlign:'left',color:'inherit',padding:0}}><b>{m.name}</b><div className="muted" style={{fontSize:12}}>{c?c.name:'No container assigned'} · {m.servings} serving{m.servings===1?'':'s'}</div></button>
            <div className="planner-actions"><button onClick={()=>onSchedule(m)}>Reschedule</button><button onClick={()=>onRemoveSchedule(m)}>Remove</button></div>
          </article></div>
        }):<button className="planner-empty" onClick={onAdd}><Plus size={16}/> Add {category.toLowerCase()}</button>}
      </section>
    })}
  </div>
}

function ScheduleModal({meal,onClose,onSave}:{meal:Meal;onClose:()=>void;onSave:(date:string,time:string,category:Meal['category'])=>void}) {
  const [date,setDate]=useState(meal.eatingDate||iso(0))
  const [time,setTime]=useState(meal.eatingTime||'12:30')
  const [category,setCategory]=useState(meal.category)
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Schedule meal">
    <section className="modal">
      <div className="modal-header"><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button><b>Schedule meal</b><span/></div>
      <h2 style={{margin:'4px 0 16px'}}>{meal.name}</h2>
      <div className="field"><label htmlFor="schedule-date">Date</label><input id="schedule-date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
      <div className="field"><label htmlFor="schedule-time">Eating time</label><input id="schedule-time" type="time" value={time} onChange={e=>setTime(e.target.value)}/></div>
      <div className="field"><label htmlFor="schedule-category">Meal type</label><select id="schedule-category" value={category} onChange={e=>setCategory(e.target.value as Meal['category'])}><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select></div>
      <button className="primary-button" style={{width:'100%'}} disabled={!date||!time} onClick={()=>onSave(date,time,category)}>Save schedule</button>
    </section>
  </div>
}

function NutritionScreen({meals,selectedDay,preferences}:{meals:Meal[];selectedDay:string;preferences:Preferences}) {
  const [goals,setGoals]=useStored('prep.goals',{calories:2200,protein:110,carbs:260,fat:70})
  const [visible,setVisible]=useStored('prep.visibleProgress',['calories','protein','carbs','fat','vitamin-c','vitamin-a','vitamin-d','iron'])
  const [goalsOpen,setGoalsOpen]=useState(false)
  const [progressOpen,setProgressOpen]=useState(false)
  const totals=useMemo(()=>{
    const result={calories:0,protein:0,carbs:0,fat:0}
    meals.filter(m=>m.eatingDate===selectedDay&&!m.eaten).forEach(meal=>{
      meal.ingredients.forEach(item=>{
        const db=ingredientDb.find(i=>i.name===item.name)
        if(!db)return
        const factor=item.grams/100*meal.servings
        result.calories+=db.calories*factor
        result.protein+=db.protein*factor
        result.carbs+=db.carbs*factor
        result.fat+=db.fat*factor
      })
    })
    return result
  },[meals,selectedDay])
  const rows=[
    ['Calories','calories',Math.round(totals.calories),goals.calories],
    ['Protein','protein',Math.round(totals.protein),goals.protein],
    ['Carbs','carbs',Math.round(totals.carbs),goals.carbs],
    ['Fat','fat',Math.round(totals.fat),goals.fat],
    ['Vitamin C','vitamin-c',Math.round(totals.protein*0.38),90],
    ['Vitamin A','vitamin-a',Math.round(totals.protein*1.6),900],
    ['Vitamin D','vitamin-d',3,20],
    ['Iron','iron',Math.round(totals.protein*0.12),18],
  ] as const
  const balanceScore=Math.max(0,Math.min(100,Math.round(
    rows.reduce((sum,[, ,value,goal])=>{
      const ratio=goal>0?value/goal:0
      return sum + Math.max(0,100-Math.abs(100-ratio*100)*1.15)
    },0)/rows.length)
  ))
  const dietaryText=preferences.dietary.join(', ')
  const suggestions=[
    ...(dietaryText.includes('Vegetarian')||dietaryText.includes('Vegan')?[{title:'Add a tofu protein source',text:'Try edamame, tofu, or black beans for a satisfying plant-based boost.',icon:'protein'}]:[]),
    {title:'Add a little more variety',text:"A side of colorful vegetables can complement today's meals.",icon:'variety'},
    {title:'Keep hydration in mind',text:'Pair your next meal with water or a caffeine-free drink.',icon:'hydration'},
  ]
  return <div className="content">
    <div className="topbar nutrition-topbar"><h1 className="screen-title">Nutrition</h1><Leaf/></div>
    <section className="balance-card">
      <div className="balance-score-row">
        <div><div className="eyebrow">Meal balance score</div><h2>{balanceScore}<span>/100</span></h2><p>Based on today's scheduled meals</p></div>
        <div className="balance-actions">
          <button onClick={()=>setGoalsOpen(true)} aria-label="Edit daily goals"><Settings2 size={17}/></button>
        </div>
      </div>
      <div className="balance-progress-heading"><span>Daily progress</span></div>
      <div className="balance-progress-list">
        {rows.filter(([,key])=>visible.includes(key)).map(([label,key,value,goal],index,visibleRows)=><div className={`balance-progress-card ${visibleRows.length%2===1&&index===visibleRows.length-1?'full-width':''}`} key={key}>
          <div className="progress-card-head"><span className={`progress-icon ${key}`}>{key==='calories'?<Flame size={16}/>:key==='protein'?<Dumbbell size={16}/>:key==='carbs'?<Apple size={16}/>:<Leaf size={16}/>}</span><b>{label}</b><span>{value} <small>/ {goal}{key==='calories'?' kcal':key==='vitamin-c'||key==='iron'?' mg':key==='vitamin-a'||key==='vitamin-d'?' mcg':' g'}</small></span></div>
          <div className="progress-track"><div className={`progress-fill ${key}`} style={{width:`${Math.min(100,value/goal*100)}%`}}/></div>
        </div>)}
        {!visible.length&&<div className="balance-empty">Choose a metric in Progress settings.</div>}
      </div>
    </section>
    <div className="section-heading suggestions-heading"><h2>Simple suggestions</h2></div>
    {suggestions.map((s,i)=><div key={s.title} className={`suggestion-card ${i===0?'featured':''}`}>
      <span className="suggestion-icon">{s.icon==='hydration'?<Droplets size={20}/>:s.icon==='protein'?<Dumbbell size={20}/>:<Salad size={20}/>}</span>
      <div><b>{s.title}</b><p>{s.text}</p></div>
    </div>)}
    {preferences.avoid&&<p className="muted" style={{fontSize:12}}>Your avoid list is {preferences.avoid}. Always verify ingredient labels for allergens.</p>}
    <p className="muted" style={{fontSize:11}}>Nutritional values are estimates and are not medical guidance.</p>
    {goalsOpen&&<GoalsModal goals={goals} onClose={()=>setGoalsOpen(false)} onSave={(next)=>{setGoals(next);setGoalsOpen(false)}}/>}
    {progressOpen&&<ProgressSettingsModal visible={visible} onClose={()=>setProgressOpen(false)} onChange={setVisible}/>}
  </div>
}

function ProgressSettingsModal({visible,onClose,onChange}:{visible:string[];onClose:()=>void;onChange:(visible:string[])=>void}) {
  const options=[
    ['calories','Calories','Daily calorie progress'],
    ['protein','Protein','Protein intake progress'],
    ['carbs','Carbohydrates','Carbohydrate intake progress'],
    ['fat','Fat','Fat intake progress'],
    ['vitamin-c','Vitamin C','Vitamin C estimate'],
    ['vitamin-a','Vitamin A','Vitamin A estimate'],
    ['vitamin-d','Vitamin D','Vitamin D estimate'],
    ['iron','Iron','Iron estimate'],
  ] as const
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Daily progress settings">
    <section className="modal progress-settings-modal">
      <div className="modal-header"><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button><b>Progress settings</b><span/></div>
      <p className="progress-settings-intro">Choose which daily information appears inside your balance card.</p>
      {options.map(([key,label,description])=>{const isOn=visible.includes(key);return <button className="progress-setting-row" key={key} aria-pressed={isOn} onClick={()=>onChange(isOn?visible.filter(v=>v!==key):[...visible,key])}>
        <span><b>{label}</b><small>{description}</small></span><span className={`toggle ${isOn?'on':''}`}><span/></span>
      </button>})}
      <button className="primary-button" style={{width:'100%',marginTop:10}} onClick={onClose}>Done</button>
    </section>
  </div>
}

function GoalsModal({goals,onClose,onSave}:{goals:{calories:number;protein:number;carbs:number;fat:number};onClose:()=>void;onSave:(goals:{calories:number;protein:number;carbs:number;fat:number})=>void}) {
  const [draft,setDraft]=useState(goals)
  const fields=[
    ['calories','Calories','kcal'],
    ['protein','Protein','g'],
    ['carbs','Carbohydrates','g'],
    ['fat','Fat','g'],
  ] as const
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit daily goals">
    <section className="modal goals-modal">
      <div className="modal-header"><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button><b>Edit daily goals</b><span/></div>
      {fields.map(([key,label,unit])=><div className="field goal-field" key={key}><label htmlFor={`goal-${key}`}>{label}</label><div><input id={`goal-${key}`} type="number" min="1" value={draft[key]} onChange={e=>setDraft(v=>({...v,[key]:Number(e.target.value)||1}))}/><span>{unit}</span></div></div>)}
      <button className="primary-button" style={{width:'100%',marginTop:4}} onClick={()=>onSave(draft)}>Save goals</button>
    </section>
  </div>
}

function PreferencesModal({preferences,onClose,onSave,onReset}:{preferences:Preferences;onClose:()=>void;onSave:(p:Preferences)=>void;onReset:()=>void}) {
  const [owner,setOwner]=useState(preferences.owner)
  const [dietary,setDietary]=useState(preferences.dietary)
  const [avoid,setAvoid]=useState(preferences.avoid)
  const [notifications,setNotifications]=useState(preferences.notifications)
  const options=['Balanced','Vegetarian','Vegan','High protein','Low carb']
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Preferences">
    <section className="modal">
      <div className="modal-header"><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button><b>Preferences</b><button className="ghost-button" onClick={()=>onSave({owner,dietary,avoid,notifications})}>Save</button></div>
      <div className="field"><label htmlFor="owner-name">Owner name</label><input id="owner-name" value={owner} onChange={e=>setOwner(e.target.value)}/></div>
      <div className="field"><label>Dietary preferences</label><div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{options.map(option=><button key={option} className="secondary-button" style={{minHeight:38,padding:'8px 11px',background:dietary.includes(option)?'#26312e':'#edf1e8',color:dietary.includes(option)?'white':'#526159'}} onClick={()=>setDietary(v=>v.includes(option)?v.filter(x=>x!==option):[...v,option])}>{option}</button>)}</div></div>
      <div className="field"><label htmlFor="avoid">Allergies and ingredients to avoid</label><textarea id="avoid" value={avoid} onChange={e=>setAvoid(e.target.value)} placeholder="Example: peanuts, shellfish"/></div>
      <p className="muted" style={{fontSize:12}}>Always verify ingredient labels for allergens. Preferences are for planning suggestions only.</p>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'18px 0'}}><b>In-app notifications</b><button className={`toggle ${notifications?'on':''}`} aria-label="Toggle notifications" onClick={()=>setNotifications(v=>!v)}><span/></button></div>
      <button className="secondary-button" style={{width:'100%',marginBottom:8}} onClick={onReset}>Reset demo data</button>
    </section>
  </div>
}
