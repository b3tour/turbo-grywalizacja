'use client';

import { Mission, Submission } from '@/types';
import { Card, Badge, Button } from '@/components/ui';
import { missionTypeIcons, missionTypeNames, formatNumber } from '@/lib/utils';
import { MapPin, Clock, Star, CheckCircle, Loader2, XCircle } from 'lucide-react';

interface MissionCardProps {
  mission: Mission;
  userSubmission?: Submission | null;
  onClick?: () => void;
  compact?: boolean;
}

export function MissionCard({
  mission,
  userSubmission,
  onClick,
  compact = false,
}: MissionCardProps) {
  const isCompleted = userSubmission?.status === 'approved';
  const isPending = userSubmission?.status === 'pending';
  const isRejected = userSubmission?.status === 'rejected';

  const getStatusBadge = () => {
    if (isCompleted) {
      return (
        <Badge variant="success" size="sm">
          <CheckCircle className="w-3 h-3 mr-1" />
          Ukończono
        </Badge>
      );
    }
    if (isPending) {
      return (
        <Badge variant="warning" size="sm">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Oczekuje
        </Badge>
      );
    }
    if (isRejected) {
      return (
        <Badge variant="danger" size="sm">
          <XCircle className="w-3 h-3 mr-1" />
          Odrzucono
        </Badge>
      );
    }
    return null;
  };

  if (compact) {
    return (
      <Card
        hover={!isCompleted && !isPending}
        onClick={!isCompleted && !isPending ? onClick : undefined}
        className={isCompleted ? 'opacity-60' : ''}
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl">{missionTypeIcons[mission.type]}</div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-white truncate">{mission.title}</h4>
            <p className="text-sm text-dark-400">{missionTypeNames[mission.type]}</p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <div className="text-right">
              <div className="flex items-center text-turbo-400 font-bold">
                <Star className="w-4 h-4 mr-1" />
                {formatNumber(mission.xp_reward)}
              </div>
              <span className="text-xs text-dark-400">XP</span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      hover={!isCompleted && !isPending}
      onClick={!isCompleted && !isPending ? onClick : undefined}
      className={isCompleted ? 'opacity-70' : ''}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-dark-700 flex items-center justify-center text-2xl">
            {missionTypeIcons[mission.type]}
          </div>
          <div>
            <Badge variant="default" size="sm">
              {missionTypeNames[mission.type]}
            </Badge>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Content */}
      <h3 className="text-lg font-semibold text-white mb-2">{mission.title}</h3>
      <p className="text-dark-300 text-sm mb-4 line-clamp-2">{mission.description}</p>

      {/* Meta */}
      <div className="flex items-center gap-4 text-sm text-dark-400 mb-4">
        {mission.location_name && (
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            <span>{mission.location_name}</span>
          </div>
        )}
        {mission.end_date && (
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>
              Do {new Date(mission.end_date).toLocaleDateString('pl-PL')}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-dark-700">
        <div className="flex items-center gap-1">
          <Star className="w-5 h-5 text-turbo-400" />
          <span className="text-xl font-bold text-turbo-400">
            {formatNumber(mission.xp_reward)}
          </span>
          <span className="text-dark-400 text-sm">XP</span>
        </div>

        {!isCompleted && !isPending && (
          <Button size="sm" onClick={onClick}>
            Wykonaj misję
          </Button>
        )}

        {isCompleted && (
          <span className="text-sm text-green-400 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            +{formatNumber(userSubmission?.xp_awarded || mission.xp_reward)} XP
          </span>
        )}

        {isPending && (
          <span className="text-sm text-yellow-400">
            Czeka na weryfikację
          </span>
        )}
      </div>
    </Card>
  );
}
