import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Trash2, Edit, CheckCircle, AlertTriangle, History, LayoutDashboard, Calendar, Lock, DollarSign, LogOut } from 'lucide-react';

const API_URL = 'https://tahshin-mess-vara-tola.onrender.com/api';

function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('mess_auth') === 'true');
  const [pin, setPin] = useState('');

  const [members, setMembers] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [formData, setFormData] = useState({ name: '', room: '', rentAmount: '', previousDue: 0 });
  const [isEditing, setIsEditing] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Payment Amount State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [modal, setModal] = useState({ isOpen: false, type: '', id: null, title: '', message: '', extraData: null });

  const currentMonth = new Date().toLocaleString('bn-BD', { month: 'long', year: 'numeric' });

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // পিনটি ব্যাকএন্ডে পাঠানো হচ্ছে
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      
      // ব্যাকএন্ড যদি বলে পিন সঠিক (res.ok)
      if (res.ok) {
        setIsAuthenticated(true);
        localStorage.setItem('mess_auth', 'true'); // ব্রাউজারে সেভ করে রাখছি যেন রিলোড দিলে লগআউট না হয়
        toast.success('লগইন সফল হয়েছে!');
      } else {
        toast.error('ভুল পিন দিয়েছেন!');
      }
    } catch (error) {
      toast.error('সার্ভার কানেকশন এরর!');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('mess_auth');
    toast.success('লগআউট করা হয়েছে');
  };

  // ডাটাবেজ থেকে ডাটা আনা (আগের মতোই)
  const fetchData = async () => {
    if (!isAuthenticated) return;
    try {
      const memRes = await fetch(`${API_URL}/members`);
      const memData = await memRes.json();

      const sortedData = [...memData].sort((a, b) => {
        const roomA = String(a.room || '').trim();
        const roomB = String(b.room || '').trim();
        return roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
      });

      setMembers(sortedData);

      const histRes = await fetch(`${API_URL}/history`);
      const histData = await histRes.json();
      setHistoryData(histData);
      
    } catch (error) {
      toast.error('ডাটা লোড করতে সমস্যা হয়েছে!');
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAuthenticated]);

  // নতুন হিসাব ক্যালকুলেশন (আংশিক পেমেন্ট ও বকেয়াসহ)
  const totalExpected = members.reduce((sum, m) => sum + (m.rentAmount + m.previousDue), 0);
  const totalCollected = members.reduce((sum, m) => sum + m.paidAmount, 0);
  const dueAmount = totalExpected - totalCollected;
  
  // যারা পুরো টাকা দিয়ে দিয়েছে তাদের কাউন্ট
  const fullyPaidMembersCount = members.filter(m => m.paidAmount >= (m.rentAmount + m.previousDue)).length;
  const unpaidMembersCount = members.length - fullyPaidMembersCount;

  // মেম্বার অ্যাড বা আপডেট করা
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, previousDue: Number(formData.previousDue) || 0 };
      
      if (isEditing) {
        await fetch(`${API_URL}/members/${isEditing}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        toast.success('মেম্বারের তথ্য আপডেট হয়েছে!');
        setIsEditing(null);
      } else {
        await fetch(`${API_URL}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        toast.success('নতুন মেম্বার যুক্ত হয়েছে!');
      }
      setFormData({ name: '', room: '', rentAmount: '', previousDue: 0 });
      fetchData();
    } catch (error) {
      toast.error('কোনো একটি সমস্যা হয়েছে!');
    }
  };

  // মডাল কনফার্মেশন অ্যাকশন (নতুন পেমেন্ট লজিকসহ)
  const handleModalConfirm = async () => {
    try {
      if (modal.type === 'delete') {
        await fetch(`${API_URL}/members/${modal.id}`, { method: 'DELETE' });
        toast.success('মেম্বার ডিলিট করা হয়েছে!');
      } else if (modal.type === 'reset') {
        await fetch(`${API_URL}/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ monthName: currentMonth })
        });
        toast.success('নতুন মাস সফলভাবে শুরু হয়েছে!');
        setActiveTab('history');
      } else if (modal.type === 'pay') {
        if (!paymentAmount || paymentAmount <= 0) {
          return toast.error('সঠিক টাকার পরিমাণ দিন!');
        }
        await fetch(`${API_URL}/members/${modal.id}/pay`, { 
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: paymentAmount })
        });
        toast.success('পেমেন্ট গ্রহণ করা হয়েছে!');
      } else if (modal.type === 'unpay') {
        await fetch(`${API_URL}/members/${modal.id}/unpay`, { method: 'PUT' });
        toast.success('পেমেন্ট বাতিল করা হয়েছে!');
      }

      fetchData();
      setModal({ isOpen: false });
      setPaymentAmount('');
    } catch (error) {
      toast.error('কাজটি সম্পন্ন করা যায়নি!');
    }
  };

  // লগইন স্ক্রিন (যদি অথেনটিকেটেড না হয়)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
        <Toaster position="top-right" />
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center border border-slate-100 animate-in zoom-in-95 duration-300">
          <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Lock className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">মেস ম্যানেজমেন্ট</h2>
          <p className="text-slate-500 mb-8 text-sm">অ্যাডমিন প্যানেলে প্রবেশ করতে পিন দিন</p>
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              placeholder="••••" 
              className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-center text-3xl tracking-[1em] font-mono outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all mb-6"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
            <button type="submit" className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold cursor-pointer hover:bg-indigo-700 transition shadow-md hover:shadow-lg active:scale-95">
              প্রবেশ করুন
            </button>
          </form>
          <p className="text-xs text-slate-400 mt-6 font-mono">Default PIN: 1234</p>
        </div>
      </div>
    );
  }

  // মূল ড্যাশবোর্ড
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans text-slate-800">
      <Toaster position="top-right" />

      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">

        {/* হেডার ও নেভিগেশন (লগআউট বাটন যুক্ত করা হয়েছে) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">মেস ম্যানেজমেন্ট</h1>
            <p className="text-indigo-600 font-semibold flex items-center mt-1">
              <Calendar className="w-4 h-4 mr-1" /> চলতি মাস: {currentMonth}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2 rounded-md font-medium cursor-pointer transition-all ${activeTab === 'dashboard' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <LayoutDashboard className="w-4 h-4" /> <span>ড্যাশবোর্ড</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2 rounded-md font-medium cursor-pointer transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <History className="w-4 h-4" /> <span>পূর্বের হিসাব</span>
              </button>
            </div>
            <button 
              onClick={handleLogout} 
              className="flex items-center justify-center px-4 py-2 text-rose-600 font-medium cursor-pointer hover:bg-rose-50 rounded-lg transition"
            >
              <LogOut className="w-4 h-4 mr-2" /> লগআউট
            </button>
          </div>
        </div>

        {/* ড্যাশবোর্ড ভিউ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
            {/* সামারি কার্ডস (তোমার আগের ডিজাইন অনুযায়ী আপডেট করা হয়েছে) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-indigo-500">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">মোট প্রাপ্য (বকেয়াসহ)</p>
                <h2 className="text-2xl font-bold text-slate-800">৳ {totalExpected}</h2>
                <p className="text-xs text-slate-400 mt-1">মোট মেম্বার: {members.length} জন</p>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-emerald-500">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">এ পর্যন্ত আদায়</p>
                <h2 className="text-2xl font-bold text-emerald-600">৳ {totalCollected}</h2>
                <p className="text-xs text-emerald-600 font-medium mt-1">ফুল পেইড: {fullyPaidMembersCount} জন</p>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-rose-500">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">বর্তমান বকেয়া</p>
                <h2 className="text-2xl font-bold text-rose-600">৳ {dueAmount}</h2>
                <p className="text-xs text-rose-600 font-medium mt-1">ভাড়া বাকি: {unpaidMembersCount} জনের</p>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-amber-400">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">আদায়ের হার</p>
                <h2 className="text-2xl font-bold text-slate-800">
                  {totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0}%
                </h2>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2">
                  <div
                    className="bg-amber-400 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
              {/* অ্যাড/এডিট মেম্বার ফর্ম */}
              <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 sticky top-6">
                  <h3 className="text-lg font-semibold mb-4">{isEditing ? 'মেম্বার আপডেট করুন' : 'নতুন মেম্বার অ্যাড করুন'}</h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">নাম</label>
                      <input type="text" required className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">রুম নম্বর</label>
                      <input type="text" required className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.room} onChange={(e) => setFormData({ ...formData, room: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">মাসিক ভাড়া</label>
                        <input type="number" required className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.rentAmount} onChange={(e) => setFormData({ ...formData, rentAmount: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-rose-600 mb-1">আগের বকেয়া</label>
                        <input type="number" className="w-full border border-rose-200 bg-rose-50 text-rose-700 p-2 rounded-lg outline-none focus:ring-2 focus:ring-rose-500" value={formData.previousDue} onChange={(e) => setFormData({ ...formData, previousDue: e.target.value })} placeholder="০" />
                      </div>
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium cursor-pointer hover:bg-indigo-700 transition active:scale-95">
                      {isEditing ? 'আপডেট করুন' : 'অ্যাড করুন'}
                    </button>
                    {isEditing && (
                      <button type="button" onClick={() => { setIsEditing(null); setFormData({ name: '', room: '', rentAmount: '', previousDue: 0 }) }} className="w-full mt-2 bg-slate-100 text-slate-600 py-2 rounded-lg font-medium cursor-pointer hover:bg-slate-200 transition">
                        ক্যান্সেল
                      </button>
                    )}
                  </form>
                </div>
              </div>

              {/* মেম্বার লিস্ট টেবিল */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="p-4 font-semibold text-slate-600">মেম্বার ও রুম</th>
                          <th className="p-4 font-semibold text-slate-600">ভাড়ার হিসাব</th>
                          <th className="p-4 font-semibold text-slate-600">পেমেন্ট স্ট্যাটাস</th>
                          <th className="p-4 font-semibold text-slate-600 text-right">অ্যাকশন</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map(member => {
                          const totalPayable = member.rentAmount + member.previousDue;
                          const currentDue = totalPayable - member.paidAmount;
                          const isFullyPaid = currentDue <= 0;

                          return (
                            <tr key={member._id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                              <td className="p-4">
                                <p className="font-semibold">{member.name}</p>
                                <p className="text-sm text-slate-500">রুম: {member.room}</p>
                              </td>
                              <td className="p-4">
                                <p className="font-medium text-slate-800">মোট প্রদেয়: ৳ {totalPayable}</p>
                                {member.previousDue > 0 ? (
                                  <p className="text-[11px] text-rose-500 font-medium">আগের বকেয়া ৳ {member.previousDue} যুক্ত আছে</p>
                                ) : (
                                  <p className="text-[11px] text-slate-400">কোনো বকেয়া নেই</p>
                                )}
                              </td>
                              <td className="p-4">
                                {member.paidAmount > 0 && (
                                  <div className="mb-2">
                                    <span className="flex items-center text-emerald-600 text-sm font-semibold bg-emerald-50 px-2 py-1 rounded w-max">
                                      <CheckCircle className="w-4 h-4 mr-1" /> জমা: ৳ {member.paidAmount}
                                    </span>
                                  </div>
                                )}
                                {!isFullyPaid ? (
                                  <div>
                                    <button 
                                      onClick={() => { 
                                        setPaymentAmount(currentDue); 
                                        setModal({ isOpen: true, type: 'pay', id: member._id, title: 'ভাড়া গ্রহণ', message: `${member.name} এর মোট পাওনা ৳${currentDue}। তিনি কত টাকা দিচ্ছেন?` }); 
                                      }} 
                                      className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-700 transition active:scale-95 shadow-sm flex items-center"
                                    >
                                      <DollarSign className="w-3.5 h-3.5 mr-1" /> পেমেন্ট নিন
                                    </button>
                                  </div>
                                ) : (
                                  <div 
                                    onClick={() => setModal({ isOpen: true, type: 'unpay', id: member._id, title: 'পেমেন্ট বাতিল?', message: `আপনি কি ভুল করে ${member.name} এর পেমেন্ট কনফার্ম করেছেন? এটি আবার Unpaid করতে চান?` })}
                                    className="flex flex-col cursor-pointer group w-max"
                                    title="ভুল হলে ক্লিক করে পেমেন্ট বাতিল করুন"
                                  >
                                    <span className="text-[11px] text-rose-500 underline opacity-0 group-hover:opacity-100 transition-opacity">রিসেট পেমেন্ট</span>
                                    <span className="text-[10px] text-slate-400 mt-0.5">{member.paidAt}</span>
                                  </div>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex justify-end space-x-2">
                                  <button onClick={() => { setIsEditing(member._id); setFormData({ name: member.name, room: member.room, rentAmount: member.rentAmount, previousDue: member.previousDue }); }} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer transition">
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setModal({ isOpen: true, type: 'delete', id: member._id, title: 'মেম্বার ডিলিট?', message: `${member.name}-কে ডিলিট করতে চান? এই অ্যাকশনটি ফেরানো যাবে না।` })} className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer transition">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {members.length === 0 && <p className="text-center text-slate-500 p-6">কোনো মেম্বার নেই। নতুন মেম্বার অ্যাড করুন।</p>}
                </div>

                {/* মাস শেষ করার বাটন (তোমার আগের ডিজাইন অনুযায়ী) */}
                {members.length > 0 && (
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setModal({ isOpen: true, type: 'reset', title: 'নতুন মাস শুরু?', message: `আপনি কি ${currentMonth} মাসের হিসাব বন্ধ করতে চান? বর্তমান বকেয়াগুলো স্বয়ংক্রিয়ভাবে পরের মাসের জন্য সেভ হয়ে যাবে।` })}
                      className="bg-rose-100 text-rose-700 px-6 py-3 rounded-xl font-bold cursor-pointer hover:bg-rose-200 transition shadow-sm flex items-center active:scale-95"
                    >
                      <AlertTriangle className="w-5 h-5 mr-2" /> এই মাসের হিসাব বন্ধ করুন
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* হিস্ট্রি ভিউ (তোমার আগের ডিজাইন হুবহু রাখা হয়েছে) */}
        {activeTab === 'history' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-xl font-bold text-slate-800 border-b pb-2">পূর্বের মাসের রেকর্ডসমূহ</h2>

            {historyData.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl text-center text-slate-500 border border-slate-100">
                এখনো কোনো মাসের হিসাব আর্কাইভ করা হয়নি। মাস শেষে "হিসাব বন্ধ করুন" বাটনে ক্লিক করলে এখানে রেকর্ড জমা হবে।
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {historyData.map((record) => (
                  <div key={record._id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-indigo-600 mb-4">{record.monthName}</h3>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">সম্ভাব্য কালেকশন:</span>
                        <span className="font-semibold text-slate-700">৳ {record.totalExpected}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">মোট আদায় হয়েছিল:</span>
                        <span className="font-semibold text-emerald-600">৳ {record.totalCollected}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
                        <span className="text-slate-500">বকেয়া ছিল:</span>
                        <span className="font-semibold text-rose-500">৳ {record.totalExpected - record.totalCollected}</span>
                      </div>
                    </div>

                    {record.unpaidMembers && record.unpaidMembers.length > 0 && (
                      <div className="mt-4 bg-rose-50 p-3 rounded-lg">
                        <p className="text-xs font-semibold text-rose-700 mb-2">যারা ভাড়া দেয়নি:</p>
                        <ul className="text-sm space-y-1">
                          {record.unpaidMembers.map((um, i) => (
                            <li key={i} className="text-rose-600 flex justify-between">
                              <span>{um.name} (রুম: {um.room})</span>
                              <span>৳{um.dueAmount}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* কাস্টম মডাল (পেমেন্ট ইনপুট লজিকসহ) */}
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full mx-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className={`p-2 rounded-full ${modal.type === 'pay' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                {modal.type === 'pay' ? <DollarSign className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <h3 className="text-xl font-bold">{modal.title}</h3>
            </div>
            <p className="text-slate-600 mb-6">{modal.message}</p>
            
            {modal.type === 'pay' && (
              <div className="mb-6 relative">
                <span className="absolute left-4 top-3 text-slate-400 font-bold">৳</span>
                <input 
                  type="number" 
                  className="w-full border border-slate-300 p-3 pl-8 rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="টাকার পরিমাণ দিন"
                  autoFocus
                />
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => { setModal({ isOpen: false }); setPaymentAmount(''); }} 
                className="px-4 py-2 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 rounded-lg transition"
              >
                বাতিল
              </button>
              <button 
                onClick={handleModalConfirm} 
                className={`px-4 py-2 font-medium cursor-pointer text-white rounded-lg transition active:scale-95 ${modal.type === 'pay' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200' : 'bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-200'}`}
              >
                নিশ্চিত করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;