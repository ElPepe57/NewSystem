import React, { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { useMercadoLibreStore } from '../../store/mercadoLibreStore';

export interface TabPreguntasProps {
  questions: any[];
}

export const TabPreguntas: React.FC<TabPreguntasProps> = ({ questions }) => {
  const { answerQuestion, fetchQuestions } = useMercadoLibreStore();
  const [answerTexts, setAnswerTexts] = useState<Record<number, string>>({});
  const [sending, setSending] = useState<number | null>(null);

  const handleAnswer = async (questionId: number) => {
    const text = answerTexts[questionId];
    if (!text?.trim()) return;

    setSending(questionId);
    try {
      await answerQuestion(questionId, text.trim());
      setAnswerTexts((prev) => ({ ...prev, [questionId]: '' }));
    } catch {
      // Error manejado en el store
    } finally {
      setSending(null);
    }
  };

  const unanswered = questions.filter((q) => q.status === 'UNANSWERED');
  const answered = questions.filter((q) => q.status === 'ANSWERED');

  return (
    <div className="space-y-4">
      {unanswered.length === 0 && answered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay preguntas</p>
          <button
            onClick={fetchQuestions}
            className="mt-3 text-sm text-amber-600 hover:text-amber-700 font-medium"
          >
            Actualizar
          </button>
        </div>
      ) : (
        <>
          {unanswered.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Sin responder ({unanswered.length})
              </h3>
              <div className="space-y-3">
                {unanswered.map((q) => (
                  <div key={q.id} className="bg-white rounded-xl border border-orange-200 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm text-gray-800">{q.text}</p>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                        {new Date(q.date_created).toLocaleDateString('es-PE')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">Item: {q.item_id}</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={answerTexts[q.id] || ''}
                        onChange={(e) =>
                          setAnswerTexts((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        placeholder="Escribe tu respuesta..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleAnswer(q.id)}
                      />
                      <button
                        onClick={() => handleAnswer(q.id)}
                        disabled={!answerTexts[q.id]?.trim() || sending === q.id}
                        className="px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                      >
                        <Send className={`w-4 h-4 ${sending === q.id ? 'animate-pulse' : ''}`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {answered.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Respondidas ({answered.length})
              </h3>
              <div className="space-y-2">
                {answered.map((q) => (
                  <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-800 mb-1">{q.text}</p>
                    {q.answer && (
                      <p className="text-sm text-green-700 bg-green-50 rounded-lg p-2 mt-2">
                        {q.answer.text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
