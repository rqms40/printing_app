import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function SupportPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // CAPTCHA State
  const [captchaNum1, setCaptchaNum1] = useState(Math.floor(Math.random() * 10) + 1);
  const [captchaNum2, setCaptchaNum2] = useState(Math.floor(Math.random() * 10) + 1);
  const [userCaptchaInput, setUserCaptchaInput] = useState('');

  const generateNewCaptcha = () => {
    setCaptchaNum1(Math.floor(Math.random() * 10) + 1);
    setCaptchaNum2(Math.floor(Math.random() * 10) + 1);
    setUserCaptchaInput('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // CAPTCHA Validation
    if (parseInt(userCaptchaInput) !== captchaNum1 + captchaNum2) {
      setStatus('error');
      setErrorMessage('Incorrect CAPTCHA answer. Please try again.');
      generateNewCaptcha();
      return;
    }

    // Rate Limiting
    const lastSubmission = localStorage.getItem('lastTicketSubmission');
    if (lastSubmission && Date.now() - parseInt(lastSubmission) < 60000) {
      setStatus('error');
      const secondsLeft = Math.ceil((60000 - (Date.now() - parseInt(lastSubmission))) / 1000);
      setErrorMessage(`You are submitting tickets too fast. Please wait ${secondsLeft} seconds.`);
      return;
    }

    setStatus('loading');

    try {
      const response = await fetch('http://localhost:3000/api/support-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to submit ticket');
      }

      setStatus('success');
      setFormData({ name: '', email: '', subject: '', message: '' });
      generateNewCaptcha();
      localStorage.setItem('lastTicketSubmission', Date.now().toString());
    } catch (error: unknown) {
      console.error('Submission error:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred. Please try again.');
      generateNewCaptcha();
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative flex flex-col items-center py-20 px-6">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-[#FFDE58]/5 to-transparent pointer-events-none" />
      <div className="absolute top-[20%] left-[50%] -translate-x-1/2 w-[800px] h-[800px] bg-[#FFDE58]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-3xl relative z-10 flex flex-col items-center">
        <Link to="/" className="self-start flex items-center gap-2 text-gray-400 hover:text-[var(--color-primary)] transition-colors mb-12">
          <ArrowLeft size={20} />
          <span>Back to Home</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-[#FFDE58]/10 text-[var(--color-primary)] px-4 py-2 rounded-full text-sm font-medium mb-6 border border-[#FFDE58]/20">
            <ShieldCheck size={18} />
            Secure Support Portal
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">How can we help?</h1>
          <p className="text-gray-400 max-w-lg mx-auto">
            Submit a ticket below and our support team will get back to you via email shortly.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full bg-white/5 border border-white/10 rounded-3xl p-8 md:p-10 backdrop-blur-xl shadow-2xl relative overflow-hidden"
        >
          {status === 'success' ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 size={64} className="text-[var(--color-primary)] mb-6" />
              <h2 className="text-2xl font-bold mb-3">Ticket Submitted Successfully!</h2>
              <p className="text-gray-400 mb-8 max-w-md">
                We've received your concern. Our team will review it and reply to the email address you provided.
              </p>
              <button
                onClick={() => setStatus('idle')}
                className="px-8 py-3 bg-[var(--color-primary)] text-black font-semibold rounded-full hover:bg-[#e6c84f] transition-colors"
              >
                Submit Another Ticket
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label htmlFor="name" className="text-sm font-medium text-gray-300">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all"
                    placeholder="John Doe"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="email" className="text-sm font-medium text-gray-300">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="subject" className="text-sm font-medium text-gray-300">Subject</label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  required
                  value={formData.subject}
                  onChange={handleChange}
                  className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all"
                  placeholder="E.g. Issue with order #1234"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="message" className="text-sm font-medium text-gray-300">How can we help?</label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  value={formData.message}
                  onChange={handleChange}
                  className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all resize-none"
                  placeholder="Please describe your issue or concern in detail..."
                />
              </div>

              {/* CAPTCHA Field */}
              <div className="flex flex-col gap-2">
                <label htmlFor="captcha" className="text-sm font-medium text-gray-300">
                  Security Check: What is {captchaNum1} + {captchaNum2}?
                </label>
                <input
                  type="number"
                  id="captcha"
                  name="captcha"
                  required
                  value={userCaptchaInput}
                  onChange={(e) => setUserCaptchaInput(e.target.value)}
                  className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all"
                  placeholder="Enter the answer..."
                />
              </div>

              {status === 'error' && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="mt-4 flex items-center justify-center gap-2 w-full py-4 bg-[var(--color-primary)] text-black font-bold rounded-xl hover:bg-[#e6c84f] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? (
                  <span className="animate-pulse">Submitting...</span>
                ) : (
                  <>
                    <span>Submit Ticket</span>
                    <Send size={18} />
                  </>
                )}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
