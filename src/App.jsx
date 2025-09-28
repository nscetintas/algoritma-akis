import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  Handle,
  MarkerType,
  Position,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import * as htmlToImage from 'html-to-image' // ← kapanış tırnağı eklendi

/* ---------- BASE URL (GitHub Pages için) ---------- */
const BASE = import.meta.env.BASE_URL // örn lokalde "/", Pages'te "/REPO_ADI/"

/* ---------- LocalStorage ---------- */
const LS = {
  USER: 'algApp_user',
  CLASS: 'algApp_class',
  ALGO: 'algApp_algorithm',
  FLOW: 'algApp_flow',
  BOARD: 'algApp_leaderboard',
  START: 'algApp_startTime',
}
const readLS = (k, f = null) => {
  try {
    const v = localStorage.getItem(k)
    return v ? JSON.parse(v) : f
  } catch {
    return f
  }
}
const writeLS = (k, v) => localStorage.setItem(k, JSON.stringify(v))
const uid = () => Math.random().toString(36).slice(2)

/* ---------- Helpers ---------- */
const Port = ({ type, pos = 'top' }) => (
  <Handle
    type={type}
    position={
      {
        top: Position.Top,
        bottom: Position.Bottom,
        left: Position.Left,
        right: Position.Right,
      }[pos]
    }
  />
)

/* ---------- Node bileşenleri (PNG) ---------- */
const ImgNodeBase = ({ src, alt, label, ports = ['top', 'bottom'] }) => (
  <div className="node">
    {ports.includes('top') && <Port type="target" pos="top" />}
    <img src={src} alt={alt} className="shape-img" draggable={false} />
    <div className="label">{label}</div>
    {ports.includes('left') && <Port type="source" pos="left" />}
    {ports.includes('right') && <Port type="source" pos="right" />}
    {ports.includes('bottom') && <Port type="source" pos="bottom" />}
  </div>
)
const StartEndNode = ({ data }) => (
  <ImgNodeBase
    src={`${BASE}shapes/basla.png`}
    alt="Başla/Bitir"
    label={data.label || 'Başla / Bitir'}
  />
)
const ProcessNode = ({ data }) => (
  <ImgNodeBase
    src={`${BASE}shapes/islem.png`}
    alt="İşlem"
    label={data.label || 'İşlem / Eylem'}
  />
)
const InputNode = ({ data }) => (
  <ImgNodeBase
    src={`${BASE}shapes/girdi.png`}
    alt="Girdi"
    label={data.label || 'Girdi'}
  />
)
const OutputNode = ({ data }) => (
  <ImgNodeBase
    src={`${BASE}shapes/cikti.png`}
    alt="Çıktı"
    label={data.label || 'Çıktı'}
  />
)
const DecisionNode = ({ data }) => (
  <ImgNodeBase
    src={`${BASE}shapes/kosul.png`}
    alt="Koşul"
    label={data.label || 'Koşul ?'}
    ports={['top', 'left', 'right', 'bottom']}
  />
)
const nodeTypes = {
  startEnd: StartEndNode,
  process: ProcessNode,
  input: InputNode,
  decision: DecisionNode,
  output: OutputNode,
}

/* ---------- Palette (5 sütun, küçük ikonlar ve aralıklı) ---------- */
function ShapeIcon({ type }) {
  const map = {
    startEnd: `${BASE}shapes/basla.png`,
    input: `${BASE}shapes/girdi.png`,
    process: `${BASE}shapes/islem.png`,
    decision: `${BASE}shapes/kosul.png`,
    output: `${BASE}shapes/cikti.png`,
  }
  return <img src={map[type]} alt={type} className="palette-icon" />
}
function PaletteItem({ type, label }) {
  const onDragStart = (evt) => {
    evt.dataTransfer.setData('application/reactflow', type)
    evt.dataTransfer.effectAllowed = 'move'
  }
  return (
    <div
      className="palette-item"
      draggable
      onDragStart={onDragStart}
      title={label}
    >
      <ShapeIcon type={type} />
      <div className="palette-text">{label}</div>
    </div>
  )
}
function Palette() {
  const items = [
    { type: 'startEnd', label: 'Başla / Bitir' },
    { type: 'input', label: 'Girdi' },
    { type: 'process', label: 'İşlem / Eylem' },
    { type: 'decision', label: 'Koşul' },
    { type: 'output', label: 'Çıktı' },
  ]
  return (
    <div className="palette">
      {items.map((it) => (
        <PaletteItem key={it.type} {...it} />
      ))}
    </div>
  )
}

/* ---------- Flow Editor (her zaman görünür; gerekirse kilit overlay) ---------- */
function FlowEditor({ onSaveFlow, locked }) {
  const { screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [editing, setEditing] = useState({ open: false, id: null, text: '' })
  const wrapperForPngRef = useRef(null)

  const edgeOptions = useMemo(
    () => ({
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--success)' },
      style: { stroke: 'var(--success)', strokeWidth: 2 },
    }),
    []
  )

  const onConnect = useCallback(
    (conn) => {
      if (locked) return
      setEdges((eds) => addEdge({ ...conn, ...edgeOptions }, eds))
    },
    [edgeOptions, setEdges, locked]
  )

  const onDrop = useCallback(
    (event) => {
      event.preventDefault()
      if (locked) return
      const type = event.dataTransfer.getData('application/reactflow')
      if (!type) return
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      const newNode = { id: uid(), type, position, data: { label: '' } }
      setNodes((nds) => nds.concat(newNode))
    },
    [screenToFlowPosition, setNodes, locked]
  )

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])
  const onNodeDoubleClick = useCallback(
    (_e, node) => {
      if (locked) return
      setEditing({ open: true, id: node.id, text: node.data?.label || '' })
    },
    [locked]
  )

  const applyEdit = () => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === editing.id
          ? { ...n, data: { ...n.data, label: editing.text } }
          : n
      )
    )
    setEditing({ open: false, id: null, text: '' })
  }

  useEffect(() => {
    const saved = readLS(LS.FLOW)
    if (saved?.nodes && saved?.edges) {
      setNodes(saved.nodes)
      setEdges(saved.edges)
    }
  }, [setNodes, setEdges])

  const clearAll = () => {
    if (!locked) {
      setNodes([])
      setEdges([])
    }
  }

  const handleSave = async () => {
    const payload = { nodes, edges }
    writeLS(LS.FLOW, payload)
    let pngDataUrl = null
    try {
      const el = wrapperForPngRef.current
      if (el) {
        pngDataUrl = await htmlToImage.toPng(el, {
          pixelRatio: 2,
          cacheBust: true,
        })
      }
    } catch {
      /* ignore */
    }
    onSaveFlow({ flow: payload, image: pngDataUrl })
  }

  return (
    <div className="flow-shell">
      <div className="panel" style={{ marginTop: 10 }}>
        <div className="panel-body">
          <p className="small">
            Paletten şekli sürükleyip noktalı alana bırak. Çift tıkla → metni
            düzenle. Portlardan sürükleyip ok oluştur.
          </p>

          <Palette />

          <div
            className="row"
            style={{ margin: '6px 0 10px', flexWrap: 'wrap', gap: 8 }}
          >
            <button className="button" onClick={clearAll} disabled={locked}>
              Hepsini Temizle
            </button>
            <button
              className="button primary"
              onClick={handleSave}
              disabled={locked}
            >
              Akış Diyagramını Kaydet
            </button>
          </div>

          <div className="rf-wrapper" onDrop={onDrop} onDragOver={onDragOver}>
            <div
              ref={wrapperForPngRef}
              className={locked ? 'locked' : ''}
              style={{ height: '100%', position: 'relative' }}
            >
              {locked && (
                <div className="rf-lock">
                  <span>Önce algoritmayı “Başla … Bitir” şartıyla kaydet.</span>
                </div>
              )}
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeDoubleClick={onNodeDoubleClick}
                fitView
                defaultEdgeOptions={edgeOptions}
                proOptions={{ hideAttribution: true }}
              >
                <MiniMap />
                <Controls />
                <Background />
              </ReactFlow>
            </div>
          </div>

          {editing.open && (
            <div
              className="modal"
              onMouseDown={() =>
                setEditing({ open: false, id: null, text: '' })
              }
            >
              <div
                className="modal-content"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <h3 style={{ marginTop: 0 }}>Şekil Metnini Düzenle</h3>
                <input
                  className="input"
                  value={editing.text}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s, text: e.target.value }))
                  }
                  placeholder="Etiketi yazın"
                  style={{ width: '100%', marginBottom: 10 }}
                />
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button
                    className="button ghost"
                    onClick={() =>
                      setEditing({ open: false, id: null, text: '' })
                    }
                  >
                    İptal
                  </button>
                  <button className="button primary" onClick={applyEdit}>
                    Kaydet
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- App ---------- */
function InnerApp() {
  const [user] = useState(() => readLS(LS.USER, ''))
  const [cls] = useState(() => readLS(LS.CLASS, ''))
  const [nameInput, setNameInput] = useState(user)
  const [classInput, setClassInput] = useState(cls)
  const [steps, setSteps] = useState(() => readLS(LS.ALGO, ['']))
  const [savedAlgo, setSavedAlgo] = useState(() => readLS(LS.ALGO, null))
  const [startTs, setStartTs] = useState(() => readLS(LS.START, null))
  const [secs, setSecs] = useState(0)
  const [showHistory, setShowHistory] = useState(false)
  const [preview, setPreview] = useState(null)
  const [showStart, setShowStart] = useState(
    () => !(readLS(LS.USER, '') && readLS(LS.CLASS, ''))
  )

  // sayaç
  const tickRef = useRef(null)
  useEffect(() => {
    if (startTs) {
      if (tickRef.current) clearInterval(tickRef.current)
      tickRef.current = setInterval(
        () => setSecs(Math.floor((Date.now() - startTs) / 1000)),
        250
      )
    } else {
      if (tickRef.current) clearInterval(tickRef.current)
      setSecs(0)
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [startTs])

  const saveUser = () => {
    const n = nameInput.trim(),
      c = classInput.trim()
    if (!n || !c) return
    writeLS(LS.USER, n)
    writeLS(LS.CLASS, c)
    const now = Date.now()
    writeLS(LS.START, now)
    setStartTs(now)
    setShowStart(false)
  }

  // adım sürükle-bırak
  const dragIndexRef = useRef(null)
  const onStepDragStart = (i) => (e) => {
    dragIndexRef.current = i
    e.dataTransfer.effectAllowed = 'move'
  }
  const onStepDragOver = (e) => {
    e.preventDefault()
  }
  const onStepDrop = (i) => (e) => {
    e.preventDefault()
    const from = dragIndexRef.current
    if (from === null || from === i) return
    setSteps((s) => {
      const arr = [...s]
      const [m] = arr.splice(from, 1)
      arr.splice(i, 0, m)
      return arr
    })
    dragIndexRef.current = null
  }

  const addStep = () => setSteps((s) => [...s, ''])
  const removeStep = (i) => setSteps((s) => s.filter((_, idx) => idx !== i))
  const updateStep = (i, val) =>
    setSteps((s) => s.map((it, idx) => (idx === i ? val : it)))
  const moveStep = (i, dir) => {
    setSteps((s) => {
      const k = [...s],
        j = i + dir
      if (j < 0 || j >= k.length) return k
      const t = k[i]
      k[i] = k[j]
      k[j] = t
      return k
    })
  }

  const saveAlgorithm = () => {
    const cleaned = steps.map((s) => s.trim()).filter(Boolean)
    const first = (cleaned[0] || '').toLocaleLowerCase('tr-TR')
    const last = (cleaned[cleaned.length - 1] || '').toLocaleLowerCase('tr-TR')
    if (first !== 'başla' || last !== 'bitir') {
      alert(
        'Algoritmanızda bulunan temel bir yanlış sebebiyle algoritmanız kaydedilemedi.'
      )
      return
    }
    writeLS(LS.ALGO, cleaned)
    setSavedAlgo(cleaned)
  }

  const onSaveFlow = ({ flow, image }) => {
    if (!savedAlgo) {
      alert('Önce algoritmayı kaydet.')
      return
    }
    const started = readLS(LS.START, Date.now())
    const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000))
    const entry = {
      id: uid(),
      name: readLS(LS.USER, '') || 'İsimsiz',
      cls: readLS(LS.CLASS, '-') || '-',
      steps: savedAlgo.length,
      seconds,
      when: new Date().toISOString().slice(0, 19).replace('T', ' '),
      flow,
      image,
    }
    const board = readLS(LS.BOARD, [])
    board.push(entry)
    writeLS(LS.BOARD, board.slice(-200))
    alert('Akış diyagramı kaydedildi ve History’e eklendi!')
  }

  const leaderboard = readLS(LS.BOARD, [])

  // GİRİŞ EKRANI
  if (showStart) {
    return (
      <div className="start-screen">
        <div className="start-card separate">
          <div className="logo-wrap center">
            <img src={`${BASE}logo.png`} className="logo x3" alt="logo" />
          </div>
          <h1>Algoritma & Akış Diyagramı Stüdyosu</h1>
          <p className="small">Devam etmek için adını ve sınıfını gir.</p>
          <div className="col inputs-narrow">
            <input
              className="input biginput same"
              placeholder="Ad Soyad"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />
            <input
              className="input biginput same"
              placeholder="Sınıf (ör. 9A)"
              value={classInput}
              onChange={(e) => setClassInput(e.target.value)}
            />
          </div>
          <button
            className="button primary bigbtn"
            onClick={saveUser}
            disabled={!nameInput.trim() || !classInput.trim()}
          >
            Start
          </button>
        </div>
      </div>
    )
  }

  // UYGULAMA EKRANI
  const locked = !savedAlgo
  return (
    <div className="app-wrap">
      <div className="topbar">
        <div className="left">
          <img src={`${BASE}logo.png`} className="logo x2" alt="logo" />
          <div className="brand">Algoritma & Akış Diyagramı Stüdyosu</div>
          <div className="userpill">
            {readLS(LS.USER, '')} · {readLS(LS.CLASS, '-')}
          </div>
        </div>

        <div className="timer timer-absolute-center">
          {startTs ? (
            <>
              Süre: {String(Math.floor(secs / 60)).padStart(2, '0')}:
              {String(secs % 60).padStart(2, '0')}
            </>
          ) : (
            <>Süre: 00:00</>
          )}
        </div>

        <button className="button history" onClick={() => setShowHistory(true)}>
          History
        </button>
      </div>

      <div className="main three-wide">
        {/* Sol – Algoritma adım editörü */}
        <div className="panel">
          <h2>Algoritma Adımları</h2>
          <div className="panel-body">
            <div style={{ marginTop: 4 }}>
              {steps.map((v, i) => (
                <div
                  className="step"
                  key={i}
                  draggable
                  onDragStart={onStepDragStart(i)}
                  onDragOver={onStepDragOver}
                  onDrop={onStepDrop(i)}
                  title="Sürükleyip bırakın (↑/↓ de çalışır)"
                  style={{ cursor: 'grab' }}
                >
                  <label>Adım {i + 1}</label>
                  <input
                    className="input"
                    value={v}
                    onChange={(e) => updateStep(i, e.target.value)}
                    placeholder="ör. Başla / ... / Bitir"
                  />
                  <button className="button" onClick={() => moveStep(i, -1)}>
                    ↑
                  </button>
                  <button className="button" onClick={() => moveStep(i, 1)}>
                    ↓
                  </button>
                  <button
                    className="button ghost"
                    onClick={() => removeStep(i)}
                  >
                    Sil
                  </button>
                </div>
              ))}
              <div className="row" style={{ marginTop: 8 }}>
                <button className="button" onClick={addStep}>
                  + Adım Ekle
                </button>
                <button className="button primary" onClick={saveAlgorithm}>
                  Algoritmayı Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Orta – Flow */}
        <div className="panel">
          <h2 style={{ margin: '14px' }}>Akış Diyagramı</h2>
          <div className="panel-body">
            <FlowEditor onSaveFlow={onSaveFlow} locked={locked} />
          </div>
        </div>

        {/* Sağ – Algoritman */}
        <div className="panel">
          <h2>Algoritman</h2>
          <div className="panel-body">
            {savedAlgo ? (
              <ul className="preview no-bullets">
                {savedAlgo.map((s, i) => (
                  <li key={i}>
                    <span className="stepno">Adım {i + 1}:</span>
                    {s || <em>(boş)</em>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small">Henüz algoritma kaydetmedin.</p>
            )}
          </div>
        </div>
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="modal">
          <div className="modal-content wide">
            <div
              className="row"
              style={{ justifyContent: 'space-between', marginBottom: 8 }}
            >
              <h3 style={{ margin: '4px 0' }}>History</h3>
              <button className="button" onClick={() => setShowHistory(false)}>
                Kapat
              </button>
            </div>
            {leaderboard.length === 0 ? (
              <p className="small">
                Henüz kayıt yok. Akış diyagramını kaydettiğinde burada
                görünecek.
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Ad</th>
                    <th>Sınıf</th>
                    <th>Adım</th>
                    <th>Süre (sn)</th>
                    <th>Zaman</th>
                    <th style={{ width: 120 }}>Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard
                    .slice()
                    .reverse()
                    .map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.cls || '-'}</td>
                        <td>{row.steps}</td>
                        <td>{row.seconds}</td>
                        <td>{row.when}</td>
                        <td>
                          <button
                            className="button compact"
                            onClick={() => setPreview(row)}
                          >
                            Görüntüle
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
            {preview && (
              <div className="modal inner">
                <div className="modal-content">
                  <div
                    className="row"
                    style={{ justifyContent: 'space-between', marginBottom: 8 }}
                  >
                    <div className="small">
                      <b>{preview.name}</b> · {preview.cls || '-'} ·{' '}
                      {preview.when} · {preview.steps} adım · {preview.seconds}{' '}
                      sn
                    </div>
                    <button className="button" onClick={() => setPreview(null)}>
                      Kapat
                    </button>
                  </div>
                  {preview.image ? (
                    <img
                      src={preview.image}
                      alt="Akış diyagramı"
                      style={{
                        maxWidth: '100%',
                        borderRadius: 12,
                        border: '1px solid #2a2f36',
                      }}
                    />
                  ) : (
                    <p className="small">
                      Bu kayıtta görüntü bulunamadı (flow verisi var).
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <InnerApp />
    </ReactFlowProvider>
  )
}
