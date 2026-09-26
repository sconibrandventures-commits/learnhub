import { useState, useEffect, useRef } from 'react'
import { useCourse } from '../../state/CourseContext'
import { useAuth } from '../../state/AuthContext'
import { useToast } from '../../state/ToastContext'
import { useAsync, useInterval } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Empty, Avatar } from '../../components/ui'
import { formatTime, formatDate } from '../../lib/helpers'

export default function Chat() {
  const { course } = useCourse()
  const { user } = useAuth()
  const toast = useToast()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const firstLoad = useRef(true)

  const { data, loading, reload, setData } = useAsync(() => backend.listMessages(course.$id), [course.$id])

  // Poll for new messages
  useInterval(() => {
    backend.listMessages(course.$id).then(setData).catch(() => {})
  }, 6000)

  useEffect(() => {
    if (firstLoad.current && data?.length) {
      bottomRef.current?.scrollIntoView()
      firstLoad.current = false
    }
  }, [data])

  async function send(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setSending(true)
    setText('')
    try {
      const msg = await backend.sendMessage(course.$id, body)
      setData((prev) => [...(prev || []), msg])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (err) {
      setText(body)
      toast.error(err.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) return <Spinner />

  const messages = data || []

  return (
    <div className="stack">
      <div>
        <h1 style={{ marginBottom: 4 }}>Class chat</h1>
        <div className="muted small">Only students registered for {course.title} and your instructor can see this chat.</div>
      </div>

      <div className="card">
        <div className="chat-wrap">
          <div className="chat-scroll">
            {messages.length === 0 ? (
              <Empty icon="chat" title="No messages yet">Say hello — start the conversation below.</Empty>
            ) : (
              messages.map((m, i) => {
                const mine = m.userId === user.$id
                const showDate = i === 0 || formatDate(m.createdAt) !== formatDate(messages[i - 1].createdAt)
                return (
                  <div key={m.$id}>
                    {showDate && (
                      <div style={{ textAlign: 'center', margin: '6px 0 16px' }}>
                        <span className="badge">{formatDate(m.createdAt)}</span>
                      </div>
                    )}
                    <div className={`msg ${mine ? 'msg--mine' : ''}`}>
                      {!mine && <Avatar name={m.user?.name} />}
                      <div className="msg__body">
                        <div className="msg__who">
                          {mine ? 'You' : m.user?.name || 'Someone'} · {formatTime(m.createdAt)}
                        </div>
                        <div className="msg__bubble">{m.body}</div>
                      </div>
                      {mine && <Avatar name={m.user?.name} />}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          <form className="chat-form" onSubmit={send}>
            <input
              type="text" value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Write a message…" maxLength={2000}
            />
            <button className="btn btn--primary" disabled={sending || !text.trim()}>
              <Icon name="chat" size={15} /> Send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
