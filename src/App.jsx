import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
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
import * as htmlToImage from 'html-to-image'

/* ---- Statik dosya kökü: İSTEDİĞİN GİBİ ---- */
const BASE = ''

/* ---- LocalStorage anahtarları ---- */
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

/* ---- Port/Handle ---- */
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

/* ---- PNG tabanlı node bileşenleri (senin görsellerin) ---- */
const ImgNodeBase = ({ src, alt, label, ports = ['top', 'bottom'] }) => (
  <div className="node">
    {ports.includes('top') && <Port type="target" pos="top" />}
    <img
      src={src}
      alt={alt}
      className="shape-img"
      draggable={false}
      crossOrigin="anonymous" /* <- ekran görüntüsü için */
    />
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
const DecisionNode = ({ data }) => (
  <ImgNodeBase
    src={`${BASE}shapes/kosul.png`}
    alt="Koşul"
    label={data.label || 'Koşul ?'}
    ports={['top', 'left', 'right', 'bottom']}
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

const nodeTypes = {
  startEnd: StartEndNode,
  process: ProcessNode,
  decision: DecisionNode,
  input: InputNode,
  output: OutputNode,
}

/* ---- Palet ---- */
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
function PaletteItem({ type, label, locked }) {
  const onDragStart = (evt) => {
    if (locked) return
    evt.dataTransfer.setData('application/reactflow', type)
    evt.dataTransfer.setData('text/plain', type)
    evt.dataTransfer.effectAllowed = 'move'
  }
  return (
    <div
      className={`palette-item${locked ? ' disabled' : ''}`}
      draggable={!locked}
      onDragStart={onDragStart}
      title={label}
    >
      <ShapeIcon type={type} />
      <div className="palette-text">{label}</div>
    </div>
  )
}
function Palette({ locked }) {
  const items = [
    { type: 'startEnd', label: 'Başla / Bitir' },
    { type: 'input', label: 'Girdi' },
    { type: 'process', label: 'İşlem / Eylem' },
    { type: 'decision', label: 'Koşul' },
    { type: 'output', label: 'Çıktı' },
  ]
  return (
    <div className={`palette${locked ? ' is-locked' : ''}`}>
      {items.map((it) => (
        <PaletteItem key={it.type} {...it} locked={locked} />
      ))}
    </div>
  )
}

/* ---- Flow Editor ---- */
function FlowEditor({ onSaveFlow, locked, algoPreviewRef }) {
  const { screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [editing, setEditing] = useState({ open: false, id: null, text: '' })

  // ReactFlow ağacının kapsayıcısı
  const rfOuterRef = useRef(null)

  const edgeOptions = useMemo(
    () => ({
      markerEnd: { type: MarkerType.ArrowClosed, color: '#58c98b' },
      style: { stroke: '#58c98b', strokeWidth: 2 },
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

  const deleteSelected = () => {
    if (locked) return
    setNodes((nds) => nds.filter((n) => !n.selected))
    setEdges((eds) => eds.filter((e) => !e.selected))
  }

  /* ---- KAYDET: Flow PNG + Algoritma PNG ---- */
  const handleSave = async () => {
    const payload = { nodes, edges }
    writeLS(LS.FLOW, payload)

    let flowImage = null
    let algoImage = null
    try {
      // React Flow’un gerçek kök DIV’ini hedefle:
      const target =
        rfOuterRef.current?.querySelector('.react-flow') || rfOuterRef.current
      if (target) {
        flowImage = await htmlToImage.toPng(target, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: 'transparent',
        })
      }
    } catch {
      /* ignore */
    }

    try {
      const a = algoPreviewRef?.current
      if (a) {
        algoImage = await htmlToImage.toPng(a, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: 'transparent',
        })
      }
    } catch {
      /* ignore */
    }

    onSaveFlow({ flow: payload, flowImage, algoImage })
  }

  return (
    <div className="flow-shell">
      <p className="small">
        Paletten şekli sürükle → tuvale bırak. Çift tıkla → etiketi düzenle.
      </p>

      <Palette locked={locked} />

      <div className="flow-toolbar">
        <button className="button" onClick={clearAll} disabled={locked}>
          Hepsini Temizle
        </button>
        <button className="button" onClick={deleteSelected} disabled={locked}>
          Seçileni Sil
        </button>
        <button
          className="button primary"
          onClick={handleSave}
          disabled={locked}
        >
          Kaydet (Flow + Algoritma)
        </button>
      </div>

      <div
        className={`rf-wrapper${locked ? ' locked-wrapper' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        ref={rfOuterRef} /* <- ekran görüntüsü hedefi için kapsayıcı */
      >
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
          <Background gap={24} size={1} />
        </ReactFlow>
      </div>

      {editing.open && (
        <div
          className="modal"
          onMouseDown={() => setEditing({ open: false, id: null, text: '' })}
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
              placeholder="Etiket"
            />
            <div className="row end gap8">
              <button
                className="button ghost"
                onClick={() => setEditing({ open: false, id: null, text: '' })}
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
  )
}

/* ---- App ---- */
function InnerApp() {
  const [nameInput, setNameInput] = useState(() => readLS(LS.USER, ''))
  const [classInput, setClassInput] = useState(() => readLS(LS.CLASS, ''))
  const [steps, setSteps] = useState(() => readLS(LS.ALGO, ['']))
  const [savedAlgo, setSavedAlgo] = useState(() => readLS(LS.ALGO, null))
  const [startTs, setStartTs] = useState(() => readLS(LS.START, null))
  const [secs, setSecs] = useState(0)
  const [showHistory, setShowHistory] = useState(false)
  const [preview, setPreview] = useState(null)
  const [showStart, setShowStart] = useState(
    () => !(readLS(LS.USER, '') && readLS(LS.CLASS, ''))
  )

  const algoPreviewRef = useRef(null) // Algoritma panelini PNG almak için

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

  // adımlar
  const addStep = () => setSteps((s) => [...s, ''])
  const removeStep = (i) => setSteps((s) => s.filter((_, idx) => idx !== i))
  const moveStep = (i, dir) =>
    setSteps((s) => {
      const k = [...s]
      const j = i + dir
      if (j < 0 || j >= k.length) return k
      ;[k[i], k[j]] = [k[j], k[i]]
      return k
    })
  const dragIndexRef = useRef(null)
  const onStepDragStart = (i) => (e) => {
    dragIndexRef.current = i
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(i))
  }
  const onStepDragOver = (e) => e.preventDefault()
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

  /* Flow + Algoritma görüntülerini History’ye kaydet */
  const onSaveFlow = ({ flow, flowImage, algoImage }) => {
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
      flowImage, // <- AKIŞ PNG
      algoImage, // <- ALGORİTMA PNG
      algo: savedAlgo, // metinler de dursun
    }
    const board = readLS(LS.BOARD, [])
    board.push(entry)
    writeLS(LS.BOARD, board.slice(-200))
    alert('Kaydedildi! (Flow + Algoritma görüntüleri History’de)')
  }

  const leaderboard = readLS(LS.BOARD, [])

  /* ---- Giriş ekranı ---- */
  if (showStart) {
    return (
      <div className="start-screen">
        <div className="start-card">
          <img src={`${BASE}shapes/logo.png`} className="logo big" alt="logo" />
          <h1>Algoritma & Akış Diyagramı Stüdyosu</h1>

          <div className="start-inputs">
            <input
              className="input biginput"
              placeholder="Ad Soyad"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />
            <input
              className="input biginput"
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

  /* ---- Uygulama ekranı ---- */
  const locked = !savedAlgo

  return (
    <div className="app-wrap">
      <div className="topbar">
        <div className="left">
          <img src={`${BASE}shapes/logo.png`} className="logo" alt="logo" />
          <div className="title-stack">
            <div className="brand">Algoritma & Akış Diyagramı Stüdyosu</div>
            <div className="user-under">
              {readLS(LS.USER, '')} · {readLS(LS.CLASS, '-')}
            </div>
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

        <button
          className="button history top-right"
          onClick={() => setShowHistory(true)}
        >
          History
        </button>
      </div>

      <div className="main three-wide">
        {/* Sol – Algoritma Adımları */}
        <div className="panel">
          <h2>Algoritma Adımları</h2>
          <div className="panel-body">
            {steps.map((v, i) => (
              <div
                className="step oneline"
                key={i}
                draggable
                onDragStart={onStepDragStart(i)}
                onDragOver={onStepDragOver}
                onDrop={onStepDrop(i)}
                title="Sürükleyip bırakın ya da ↑/↓ ile taşıyın"
                style={{ cursor: 'grab' }}
              >
                <label>Adım {i + 1}</label>
                <input
                  className="input step-input"
                  value={v}
                  onChange={(e) =>
                    setSteps((s) =>
                      s.map((it, idx) => (idx === i ? e.target.value : it))
                    )
                  }
                  placeholder="ör. Başla / ... / Bitir"
                />
                <div className="step-actions">
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
              </div>
            ))}
            <div className="row gap8">
              <button className="button" onClick={addStep}>
                + Adım Ekle
              </button>
              <button className="button primary" onClick={saveAlgorithm}>
                Algoritmayı Kaydet
              </button>
            </div>
          </div>
        </div>

        {/* Orta – Akış Editörü */}
        <div className="panel">
          <h2>Akış Diyagramı</h2>
          <div className="panel-body">
            <FlowEditor
              onSaveFlow={onSaveFlow}
              locked={locked}
              algoPreviewRef={algoPreviewRef}
            />
          </div>
        </div>

        {/* Sağ – Algoritman (PNG alınan panel) */}
        <div className="panel">
          <h2>Algoritman</h2>
          <div className="panel-body" ref={algoPreviewRef}>
            {savedAlgo ? (
              <ul className="preview no-bullets">
                {savedAlgo.map((s, i) => (
                  <li key={i}>
                    <span className="stepno">Adım {i + 1}:</span>{' '}
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

      {/* History */}
      {showHistory && (
        <div className="modal">
          <div className="modal-content wide">
            <div className="row between" style={{ marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>History</h3>
              <button className="button" onClick={() => setShowHistory(false)}>
                Kapat
              </button>
            </div>

            {leaderboard.length === 0 ? (
              <p className="small">Henüz kayıt yok.</p>
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
                  <div className="row between" style={{ marginBottom: 8 }}>
                    <div className="small">
                      <b>{preview.name}</b> · {preview.cls || '-'} ·{' '}
                      {preview.when} · {preview.steps} adım · {preview.seconds}{' '}
                      sn
                    </div>
                    <button className="button" onClick={() => setPreview(null)}>
                      Kapat
                    </button>
                  </div>

                  {/* Yan yana iki görsel: Sol Flow, Sağ Algoritma */}
                  <div className="two-col">
                    <div className="shot">
                      <div className="small" style={{ marginBottom: 6 }}>
                        <b>Akış Diyagramı</b>
                      </div>
                      {preview.flowImage ? (
                        <img src={preview.flowImage} alt="Flow" />
                      ) : (
                        <p className="small">Görüntü yok.</p>
                      )}
                    </div>
                    <div className="shot">
                      <div className="small" style={{ marginBottom: 6 }}>
                        <b>Algoritma</b>
                      </div>
                      {preview.algoImage ? (
                        <img src={preview.algoImage} alt="Algoritma" />
                      ) : Array.isArray(preview.algo) &&
                        preview.algo.length > 0 ? (
                        <ol>
                          {preview.algo.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      ) : (
                        <p className="small">Görüntü yok.</p>
                      )}
                    </div>
                  </div>
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
