'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { QuizData, QuizQuestion } from '@/types';
import { CheckCircle, XCircle, Clock, ArrowRight, Zap, Timer } from 'lucide-react';

interface QuizProps {
  quizData: QuizData;
  onComplete: (answers: Record<string, string>, timeMs?: number) => void;
  onCancel: () => void;
}

export function Quiz({ quizData, onComplete, onCancel }: QuizProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Timer states
  const [timeLeft, setTimeLeft] = useState(quizData.time_limit || 0); // dla classic mode
  const [elapsedTime, setElapsedTime] = useState(0); // dla speedrun mode (w ms)
  const startTimeRef = useRef<number>(Date.now());

  const currentQuestion = quizData.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quizData.questions.length - 1;

  const isSpeedrun = quizData.mode === 'speedrun';
  const hasTimeLimit = !isSpeedrun && quizData.time_limit && quizData.time_limit > 0;

  // Timer dla classic mode (odlicza w dół)
  useEffect(() => {
    if (!hasTimeLimit || showResult || isSpeedrun) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete(answers);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasTimeLimit, showResult, answers, onComplete, isSpeedrun]);

  // Timer dla speedrun mode (liczy w górę)
  useEffect(() => {
    if (!isSpeedrun || showResult) return;

    const timer = setInterval(() => {
      setElapsedTime(Date.now() - startTimeRef.current);
    }, 100);

    return () => clearInterval(timer);
  }, [isSpeedrun, showResult]);

  const handleAnswerSelect = (answerId: string) => {
    if (showResult) return;
    setSelectedAnswer(answerId);
  };

  const handleNext = () => {
    if (!selectedAnswer) return;

    const newAnswers = {
      ...answers,
      [currentQuestion.id]: selectedAnswer,
    };
    setAnswers(newAnswers);

    if (isLastQuestion) {
      const finalTime = Date.now() - startTimeRef.current;
      setElapsedTime(finalTime);
      setShowResult(true);

      setTimeout(() => {
        onComplete(newAnswers, isSpeedrun ? finalTime : undefined);
      }, 2500);
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeMs = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const centisecs = Math.floor((ms % 1000) / 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${centisecs.toString().padStart(2, '0')}`;
  };

  const getAnswerClass = (answerId: string, isCorrect: boolean) => {
    if (!showResult) {
      return selectedAnswer === answerId
        ? 'border-turbo-500 bg-turbo-500/10'
        : 'border-dark-600 hover:border-dark-500';
    }

    if (isCorrect) {
      return 'border-green-500 bg-green-500/10';
    }

    if (selectedAnswer === answerId && !isCorrect) {
      return 'border-red-500 bg-red-500/10';
    }

    return 'border-dark-600 opacity-50';
  };

  if (showResult) {
    const correctCount = quizData.questions.filter(q => {
      const userAnswer = answers[q.id];
      const correctAnswer = q.answers.find(a => a.is_correct);
      return userAnswer === correctAnswer?.id;
    }).length;

    const score = Math.round((correctCount / quizData.questions.length) * 100);
    const passed = score >= quizData.passing_score;
    const allCorrect = correctCount === quizData.questions.length;

    return (
      <div className="p-6 text-center">
        <div
          className={cn(
            'w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4',
            passed ? 'bg-green-500/20' : 'bg-red-500/20'
          )}
        >
          {passed ? (
            <CheckCircle className="w-10 h-10 text-green-500" />
          ) : (
            <XCircle className="w-10 h-10 text-red-500" />
          )}
        </div>

        <h3 className="text-2xl font-bold text-white mb-2">
          {passed ? 'Gratulacje!' : 'Nie udało się'}
        </h3>

        <p className="text-dark-300 mb-4">
          Twój wynik: <span className="font-bold text-white">{score}%</span>
        </p>

        <p className="text-sm text-dark-400 mb-4">
          Poprawne odpowiedzi: {correctCount} z {quizData.questions.length}
          <br />
          Wymagane: {quizData.passing_score}%
        </p>

        {/* Speedrun - pokaż czas */}
        {isSpeedrun && (
          <div className={cn(
            'rounded-xl p-4 mb-4',
            allCorrect ? 'bg-turbo-500/20' : 'bg-dark-700'
          )}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Timer className={cn('w-5 h-5', allCorrect ? 'text-turbo-400' : 'text-dark-400')} />
              <span className={cn(
                'text-2xl font-mono font-bold',
                allCorrect ? 'text-turbo-400' : 'text-dark-300'
              )}>
                {formatTimeMs(elapsedTime)}
              </span>
            </div>
            {allCorrect ? (
              <p className="text-sm text-turbo-400">Twój czas został zapisany w rankingu!</p>
            ) : (
              <p className="text-sm text-dark-400">Czas nie liczy się - nie wszystkie odpowiedzi poprawne</p>
            )}
          </div>
        )}

        <div className="animate-pulse text-dark-400">
          Przetwarzanie wyników...
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header z postępem i czasem */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-dark-400">Pytanie</span>
          <span className="font-bold text-white">
            {currentQuestionIndex + 1}/{quizData.questions.length}
          </span>
        </div>

        {/* Classic mode - countdown */}
        {hasTimeLimit && (
          <div
            className={cn(
              'flex items-center gap-1 px-3 py-1 rounded-full',
              timeLeft <= 30 ? 'bg-red-500/20 text-red-400' : 'bg-dark-700 text-dark-300'
            )}
          >
            <Clock className="w-4 h-4" />
            <span className="font-mono">{formatTime(timeLeft)}</span>
          </div>
        )}

        {/* Speedrun mode - count up */}
        {isSpeedrun && (
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-turbo-500/20 text-turbo-400">
            <Zap className="w-4 h-4" />
            <span className="font-mono">{formatTimeMs(elapsedTime)}</span>
          </div>
        )}
      </div>

      {/* Tryb info */}
      {isSpeedrun && currentQuestionIndex === 0 && (
        <div className="bg-turbo-500/10 border border-turbo-500/30 rounded-xl p-3 mb-4 text-sm text-turbo-300">
          <Zap className="w-4 h-4 inline mr-1" />
          <strong>Tryb na czas!</strong> Odpowiedz poprawnie na wszystkie pytania jak najszybciej.
        </div>
      )}

      {/* Pasek postępu */}
      <div className="h-1.5 bg-dark-700 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-turbo-500 transition-all duration-300"
          style={{
            width: `${((currentQuestionIndex + 1) / quizData.questions.length) * 100}%`,
          }}
        />
      </div>

      {/* Pytanie */}
      <h3 className="text-lg font-semibold text-white mb-6">
        {currentQuestion.question}
      </h3>

      {/* Odpowiedzi */}
      <div className="space-y-3 mb-6">
        {currentQuestion.answers.map(answer => (
          <button
            key={answer.id}
            onClick={() => handleAnswerSelect(answer.id)}
            className={cn(
              'w-full p-4 text-left rounded-xl border-2 transition-all duration-200',
              getAnswerClass(answer.id, answer.is_correct)
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                  selectedAnswer === answer.id
                    ? 'border-turbo-500 bg-turbo-500'
                    : 'border-dark-500'
                )}
              >
                {selectedAnswer === answer.id && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <span className="text-white">{answer.text}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Przyciski */}
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onCancel} className="flex-1">
          Anuluj
        </Button>
        <Button
          onClick={handleNext}
          disabled={!selectedAnswer}
          className="flex-1"
        >
          {isLastQuestion ? 'Zakończ' : 'Dalej'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
