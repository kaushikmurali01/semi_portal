import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Lock, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { applicationApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { ACTIVITY_TYPES } from "@/lib/constants";
import { FacilityForm } from "./FacilityForm";

const applicationSchema = z.object({
  activityType: z.string().min(1, "Activity type is required"),
  facilityId: z.string().min(1, "Facility is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
});

interface ApplicationFormProps {
  onClose: () => void;
}

export function ApplicationForm({ onClose }: ApplicationFormProps) {
  const { toast } = useToast();
  const [generatedId, setGeneratedId] = useState("");
  const [showFacilityForm, setShowFacilityForm] = useState(false);

  const { data: facilities = [] } = useQuery({
    queryKey: ['/api/facilities'],
  });

  const { data: activitySettings = [] } = useQuery({
    queryKey: ['/api/activity-settings'],
  });

  const { data: currentCompany } = useQuery({
    queryKey: ['/api/companies/current'],
  });

  const form = useForm<z.infer<typeof applicationSchema>>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      activityType: "",
      facilityId: "",
      title: "",
      description: "",
    },
  });

  const createApplicationMutation = useMutation({
    mutationFn: applicationApi.create,
    onSuccess: (data) => {
      toast({
        title: "Application created",
        description: `Application ${data.applicationId} has been created successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Creation failed",
        description: error.message || "Failed to create application.",
        variant: "destructive",
      });
    },
  });

  const watchedValues = form.watch();

  // Generate preview ID when values change
  useState(() => {
    if (watchedValues.activityType && watchedValues.facilityId && currentCompany) {
      const facility = facilities.find(f => f.id.toString() === watchedValues.facilityId);
      const activityType = ACTIVITY_TYPES[watchedValues.activityType as keyof typeof ACTIVITY_TYPES];
      
      if (facility && activityType) {
        const previewId = `${currentCompany.shortName}-${facility.code}-${activityType.code}01`;
        setGeneratedId(previewId);
      }
    }
  }, [watchedValues.activityType, watchedValues.facilityId, currentCompany, facilities]);

  const onSubmit = (values: z.infer<typeof applicationSchema>) => {
    createApplicationMutation.mutate({
      ...values,
      facilityId: parseInt(values.facilityId),
    });
  };

  const getActivityIcon = (activityType: string) => {
    const activity = ACTIVITY_TYPES[activityType as keyof typeof ACTIVITY_TYPES];
    if (!activity) return null;

    const colorClass = {
      blue: "bg-blue-100 text-blue-600",
      purple: "bg-purple-100 text-purple-600", 
      indigo: "bg-indigo-100 text-indigo-600",
      green: "bg-green-100 text-green-600",
      teal: "bg-teal-100 text-teal-600",
      orange: "bg-orange-100 text-orange-600"
    }[activity.color];

    return (
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClass}`}>
        <span className="font-bold">{activity.icon}</span>
      </div>
    );
  };

  const isActivityEnabled = (activityType: string) => {
    const setting = activitySettings.find(s => s.activityType === activityType);
    return setting?.isEnabled || false;
  };

  const requiresFRA = (activityType: string) => {
    const setting = activitySettings.find(s => s.activityType === activityType);
    return setting?.requiresFRA || false;
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start New Application</DialogTitle>
          <DialogDescription>
            Create a new energy management application for your facility.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Activity Type Selection */}
            <FormField
              control={form.control}
              name="activityType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Activity Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="grid grid-cols-1 gap-3"
                    >
                      {Object.entries(ACTIVITY_TYPES).map(([key, activity]) => {
                        const enabled = isActivityEnabled(key);
                        const needsFRA = requiresFRA(key);
                        
                        return (
                          <div key={key}>
                            <Label
                              htmlFor={key}
                              className={`relative flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                                !enabled ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              <RadioGroupItem
                                value={key}
                                id={key}
                                className="sr-only"
                                disabled={!enabled}
                              />
                              <div className="flex items-center space-x-4 w-full">
                                {getActivityIcon(key)}
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900">
                                    {activity.name} ({key})
                                  </h4>
                                  <p className="text-sm text-gray-500">{activity.description}</p>
                                  {needsFRA && (
                                    <Badge variant="outline" className="mt-1">
                                      Requires completed FRA
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2">
                                  {!enabled && <Lock className="h-4 w-4 text-gray-400" />}
                                  <div className={`w-5 h-5 border-2 rounded-full ${
                                    field.value === key ? 'border-primary bg-primary' : 'border-gray-300'
                                  }`}>
                                    {field.value === key && (
                                      <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Facility Selection */}
            <FormField
              control={form.control}
              name="facilityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Facility</FormLabel>
                  {facilities.length === 0 ? (
                    <div className="space-y-3">
                      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <p className="text-sm text-gray-600 mb-3">
                          No facilities found. You need to create a facility before starting an application.
                        </p>
                        <Button 
                          type="button" 
                          onClick={() => setShowFacilityForm(true)}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create First Facility
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a facility..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {facilities.map((facility: any) => (
                          <SelectItem key={facility.id} value={facility.id.toString()}>
                            {facility.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Application Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Application Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter application title..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Brief description of this application..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Generated ID Preview */}
            {generatedId && (
              <div className="bg-gray-50 rounded-lg p-4">
                <FormLabel className="text-sm font-medium text-gray-700">
                  Generated Application ID
                </FormLabel>
                <div className="text-lg font-mono font-medium text-primary mt-1">
                  {generatedId}
                </div>
                <FormDescription className="mt-1">
                  This ID will be automatically generated when you create the application
                </FormDescription>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex space-x-4 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createApplicationMutation.isPending}
                className="flex-1"
              >
                {createApplicationMutation.isPending ? 'Creating...' : 'Create Application'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>

      {/* Facility Creation Modal */}
      {showFacilityForm && (
        <FacilityForm onClose={() => setShowFacilityForm(false)} />
      )}
    </Dialog>
  );
}
