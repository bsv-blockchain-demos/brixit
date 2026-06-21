import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { MapPin, Calendar, User, CheckCircle, AlertCircle, MessageSquare, Image as ImageIcon, Loader2, Tag, Building, Stamp, Clock, ExternalLink } from 'lucide-react';
import { useCropThresholds } from '../../contexts/CropThresholdContext';
import { getBrixColor } from '../../lib/getBrixColor';
import { getBrixQuality } from '../../lib/getBrixQuality';
import { formatUsername } from '../../lib/formatUsername';
import { formatHumanDate } from '../../lib/formatDate';
import { titleCase } from '../../lib/titleCase';
import { VerifiedBadge, BlockchainBadge } from './StatusBadges';
import { BrixDataPoint } from '../../types';
import { useImageUrls } from '../../hooks/useImageUrls';

interface SubmissionDetailsProps {
  dataPoint: BrixDataPoint;
  showImages?: boolean;
}

const SubmissionDetails: React.FC<SubmissionDetailsProps> = ({ dataPoint, showImages = true }) => {
  const { getThresholds } = useCropThresholds();
  const cropThresholds = dataPoint.cropType
    ? (getThresholds(dataPoint.cropType) ?? {
        poor: dataPoint.poorBrix ?? 0,
        average: dataPoint.averageBrix ?? 0,
        good: dataPoint.goodBrix ?? 0,
        excellent: dataPoint.excellentBrix ?? 0,
      })
    : undefined;

  const colorClass = getBrixColor(dataPoint.brixLevel, cropThresholds, 'bg');
  const qualityText = getBrixQuality(dataPoint.brixLevel, cropThresholds);

  const imageKeys = React.useMemo(
    () =>
      showImages && Array.isArray(dataPoint.images)
        ? dataPoint.images.filter((k): k is string => typeof k === 'string' && k.length > 0)
        : [],
    [dataPoint.images, showImages],
  );
  const imageUrlsQuery = useImageUrls(dataPoint.id, imageKeys);
  const imageUrls = imageUrlsQuery.data ?? [];
  const imagesLoading = imageUrlsQuery.isLoading;
  const imagesError = imageUrlsQuery.error ? 'Failed to load images' : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl flex items-center space-x-3">
          <span>{titleCase(dataPoint.cropLabel ?? dataPoint.cropType)}</span>
          {dataPoint.verified && (
            <CheckCircle className="w-6 h-6 text-green-mid" aria-label="Verified" />
          )}
        </CardTitle>
        {dataPoint.variety && (
          <p className="text-text-mid mt-1">{dataPoint.variety}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-surface-canvas rounded-lg p-6 text-center">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <div className={`${colorClass} w-16 h-16 rounded-full flex items-center justify-center`}>
              <span className="text-white font-bold text-xl">{dataPoint.brixLevel}</span>
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-text-dark">{dataPoint.brixLevel} BRIX</p>
              <p className="text-sm text-text-mid">Refractometer Reading</p>
              <Badge className={`${colorClass} mt-1 text-white`}>
                {qualityText} Quality
              </Badge>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-3 p-4 bg-surface-canvas rounded-lg">
            <Calendar className="w-5 h-5 text-text-mid" />
            <div>
              <p className="text-sm text-text-mid">Assessment Date</p>
              <p className="font-medium">{formatHumanDate(dataPoint.submittedAt)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-surface-canvas rounded-lg">
            <User className="w-5 h-5 text-text-mid" />
            <div>
              <p className="text-sm text-text-mid">Submitted By</p>
              <p className="font-medium">{formatUsername(dataPoint.submittedBy)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-surface-canvas rounded-lg">
            {dataPoint.verified ? (
              <CheckCircle className="w-5 h-5 text-green-mid" />
            ) : (
              <AlertCircle className="w-5 h-5 text-gold" />
            )}
            <div>
              <p className="text-sm text-text-mid">Verified</p>
              <div className="mt-0.5"><VerifiedBadge verified={!!dataPoint.verified} /></div>
            </div>
          </div>
          {dataPoint.verified && dataPoint.verifiedBy && (
            <div className="flex items-center space-x-3 p-4 bg-surface-canvas rounded-lg">
              <User className="w-5 h-5 text-text-mid" />
              <div>
                <p className="text-sm text-text-mid">Verified By</p>
                <p className="font-medium">{formatUsername(dataPoint.verifiedBy)}</p>
              </div>
            </div>
          )}
          <div className="flex items-center space-x-3 p-4 bg-surface-canvas rounded-lg">
            {dataPoint.outpoint ? (
              <Stamp className="w-5 h-5 text-select-fg" />
            ) : (
              <Stamp className="w-5 h-5 text-text-muted-brown" />
            )}
            <div className="min-w-0">
              <p className="text-sm text-text-mid">Blockchain</p>
              <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                <BlockchainBadge secured={!!dataPoint.outpoint} />
                {dataPoint.outpoint && (() => {
                  const txid = dataPoint.outpoint.split('.')[0];
                  return (
                    <a
                      href={`https://whatsonchain.com/tx/${txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-green-mid hover:text-green-fresh font-mono text-xs break-all"
                      title={`View transaction on WhatsOnChain: ${txid}`}
                    >
                      <span className="truncate">{txid.slice(0, 12)}…{txid.slice(-8)}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  );
                })()}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-surface-canvas rounded-lg">
            <MapPin className="w-5 h-5 text-text-mid" />
            <div>
              <p className="text-sm text-text-mid">Place</p>
              <p className="font-medium">{dataPoint.placeName || 'N/A'}</p>
              <p className="text-xs text-text-muted-brown">
                {dataPoint.latitude?.toFixed(4)}, {dataPoint.longitude?.toFixed(4)}
              </p>
            </div>
          </div>
          {dataPoint.locationName && (
            <div className="flex items-center space-x-3 p-4 bg-surface-canvas rounded-lg">
              <Building className="w-5 h-5 text-text-mid" />
              <div>
                <p className="text-sm text-text-mid">Store</p>
                <p className="font-medium">{dataPoint.locationName}</p>
              </div>
            </div>
          )}
          {dataPoint.brandName && (
            <div className="flex items-center space-x-3 p-4 bg-surface-canvas rounded-lg">
              <Tag className="w-5 h-5 text-text-mid" />
              <div>
                <p className="text-sm text-text-mid">Brand</p>
                <p className="font-medium">{dataPoint.brandName}</p>
              </div>
            </div>
          )}
        </div>
        {dataPoint.outlier_notes && (
          <div className="bg-surface-canvas rounded-lg p-4">
            <h3 className="font-semibold text-text-dark mb-2 flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-text-mid" />
              <span>Outlier Notes</span>
            </h3>
            <p className="text-text-mid">{dataPoint.outlier_notes}</p>
          </div>
        )}
        {showImages && (
          <div className="pt-4 border-t border-hairline">
            <h3 className="flex items-center space-x-2 text-lg font-bold text-text-dark mb-4">
              <ImageIcon className="w-6 h-6 text-text-mid" />
              <span>Reference Images ({imageUrls.length})</span>
            </h3>
            {imagesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-green-mid" />
                <span className="ml-3 text-text-mid">Loading images...</span>
              </div>
            ) : imageUrls.length === 0 ? (
              <p className="text-text-muted-brown italic">No images available for this submission.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {imageUrls.map((url: string, index: number) => (
                  <div key={index} className="relative w-full pb-[75%] rounded-lg overflow-hidden shadow-md group">
                    <img
                      src={url}
                      alt={`Submission image ${index + 1}`}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.src = 'https://placehold.co/400x300/CCCCCC/333333?text=Image+Error';
                        e.currentTarget.alt = 'Error loading image';
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SubmissionDetails;