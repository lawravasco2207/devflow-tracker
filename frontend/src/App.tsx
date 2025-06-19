import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './App.css';

interface Message {
  sender: 'user' | 'ai';
  text: string;
  command?: string | null;
  command_output?: any;
}

const API_URL = 'http://localhost:5000/chat'; // Adjust if backend runs elsewhere

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;
    const userMsg: Message = { sender: 'user', text: input };
    setMessages((msgs) => [...msgs, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await axios.post(API_URL, { message: input });
      const aiMsg: Message = {
        sender: 'ai',
        text: res.data.ai_response,
        command: res.data.command,
        command_output: res.data.command_output,
      };
      setMessages((msgs) => [...msgs, aiMsg]);
    } catch (err: any) {
      setMessages((msgs) => [
        ...msgs,
        { sender: 'ai', text: '❌ Error: ' + (err.response?.data?.error || err.message) },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <h2>Git AI Chat Assistant</h2>
      <div className="chat-box">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-msg ${msg.sender}`}>
            <div className="msg-bubble">
              <ReactMarkdown>{msg.text}</ReactMarkdown>
              {msg.command && (
                <div className="command-block">
                  <strong>Command:</strong> <code>{msg.command}</code>
                  {msg.command_output && (
                    <pre className="cmd-output">
                      {msg.command_output.stdout && <>
                        <b>stdout:</b>\n{msg.command_output.stdout}
                      </>}
                      {msg.command_output.stderr && <>
                        <b>stderr:</b>\n{msg.command_output.stderr}
                      </>}
                      {typeof msg.command_output.exit_code !== 'undefined' && <>
                        <b>exit code:</b> {msg.command_output.exit_code}
                      </>}
                      {msg.command_output.error && <>
                        <b>error:</b> {msg.command_output.error}
                      </>}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <form className="chat-input" onSubmit={sendMessage}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask me anything about your repo, git, or shell..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>Send</button>
      </form>
    </div>
  );
}

export default App;
