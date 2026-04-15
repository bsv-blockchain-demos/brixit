import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { MapPin, Calendar, User, CheckCircle, AlertCircle, MessageSquare, Image as ImageIcon, Loader2, Tag, Building } from 'lucide-react';
import { useCropThresholds } from '../../contexts/CropThresholdContext';
import { getBrixColor } from '../../lib/getBrixColor';
import { getBrixQuality } from '../../lib/getBrixQuality';
import { formatUsername } from '../../lib/formatUsername';
import { BrixDataPoint } from '../../types';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface SubmissionDetailsProps {
  dataPoint: BrixDataPoint;
  showImages?: boolean;
}

const SubmissionDetails: React.FC<SubmissionDetailsProps> = ({ dataPoint, showImages = true }) => {
  const { cache: thresholdsCache } = useCropThresholds();
  const cropThresholds = dataPoint.cropType ? (thresholdsCache[dataPoint.cropType] || {
    poor: dataPoint.poorBrix,
    average: dataPoint.averageBrix,
    good: dataPoint.goodBrix,
    excellent: dataPoint.excellentBrix,
  }) : undefined;

  const colorClass = getBrixColor(dataPoint.brixLevel, cropThresholds, 'bg');
  const qualityText = getBrixQuality(dataPoint.brixLevel, cropThresholds);

  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);

  useEffect(() => {
    const fetchImageUrls = async () => {
      if (!showImages || !dataPoint.images || !Array.isArray(dataPoint.images) || dataPoint.images.length === 0) {
        setImageUrls([]);
        setImagesLoading(false);
        return;
      }

      setImagesLoading(true);
      setImagesError(null);
      const urls: string[] = [];

      for (const imagePath of dataPoint.images) {
        if (typeof imagePath !== 'string' || imagePath === '') {
          console.warn('Invalid image path found:', imagePath);
          continue;
        }

        // Images are served from the Express backend's static uploads directory
        const publicUrl = `${API_BASE}${imagePath}`;
        urls.push(publicUrl);
      }

      setImageUrls(urls);
      setImagesLoading(false);
    };

    fetchImageUrls();
  }, [dataPoint.images, showImages]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl flex items-center space-x-3">
          <span>{dataPoint.cropType}</span>
          {dataPoint.verified && (
            <CheckCircle className="w-6 h-6 text-green-600" aria-label="Verified" />
          )}
        </CardTitle>
        {dataPoint.variety && (
          <p className="text-gray-600 mt-1">{dataPoint.variety}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <div className={`${colorClass} w-16 h-16 rounded-full flex items-center justify-center`}>
              <span className="text-white font-bold text-xl">{dataPoint.brixLevel}</span>
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-gray-900">{dataPoint.brixLevel} BRIX</p>
              <p className="text-sm text-gray-600">Refractometer Reading</p>
              <Badge className={`${colorClass} mt-1 text-white`}>
                {qualityText} Quality
              </Badge>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
            <Calendar className="w-5 h-5 text-gray-600" />
            <div>
              <p className="text-sm text-gray-600">Assessment Date</p>
              <p className="font-medium">{new Date(dataPoint.submittedAt).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
            <User className="w-5 h-5 text-gray-600" />
            <div>
              <p className="text-sm text-gray-600">Submitted By</p>
              <p className="font-medium">{formatUsername(dataPoint.submittedBy)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
            {dataPoint.verified ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            )}
            <div>
              <p className="text-sm text-gray-600">Verification Status</p>
              <p className="font-medium">{dataPoint.verified ? 'Verified' : 'Pending'}</p>
            </div>
          </div>
          {dataPoint.verified && dataPoint.verifiedBy && (
            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
              <User className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-sm text-gray-600">Verified By</p>
                <p className="font-medium">{formatUsername(dataPoint.verifiedBy)}</p>
              </div>
            </div>
          )}
          <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
            <MapPin className="w-5 h-5 text-gray-600" />
            <div>
              <p className="text-sm text-gray-600">Place</p>
              <p className="font-medium">{dataPoint.placeName || 'N/A'}</p>
              <p className="text-xs text-gray-500">
                {dataPoint.latitude?.toFixed(4)}, {dataPoint.longitude?.toFixed(4)}
              </p>
            </div>
          </div>
          {dataPoint.locationName && (
            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
              <Building className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-sm text-gray-600">Store</p>
                <p className="font-medium">{dataPoint.locationName}</p>
              </div>
            </div>
          )}
          {dataPoint.brandName && (
            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
              <Tag className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-sm text-gray-600">Brand</p>
                <p className="font-medium">{dataPoint.brandName}</p>
              </div>
            </div>
          )}
        </div>
        {dataPoint.outlier_notes && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-gray-600" />
              <span>Outlier Notes</span>
            </h3>
            <p className="text-gray-700">{dataPoint.outlier_notes}</p>
          </div>
        )}
        {showImages && (
          <div className="pt-4 border-t border-gray-100">
            <h3 className="flex items-center space-x-2 text-lg font-bold text-gray-900 mb-4">
              <ImageIcon className="w-6 h-6 text-gray-600" />
              <span>Reference Images ({imageUrls.length})</span>
            </h3>
            {imagesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-green-mid" />
                <span className="ml-3 text-gray-600">Loading images...</span>
              </div>
            ) : imageUrls.length === 0 ? (
              <p className="text-gray-500 italic">No images available for this submission.</p>
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