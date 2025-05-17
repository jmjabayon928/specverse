import { useForm } from "react-hook-form";
import { NewEstimationInput } from "@/types/estimation";

interface EstimationFormProps {
    onSubmit: (data: NewEstimationInput) => void;
}

export default function EstimationForm({ onSubmit }: EstimationFormProps) {
    const { register, handleSubmit, formState: { errors } } = useForm<NewEstimationInput>();

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
                <label className="block font-medium">Sheet ID</label>
                <input type="number" {...register("SheetID", { required: true })} className="input" />
                {errors.SheetID && <p className="text-red-500 text-sm">SheetID is required</p>}
            </div>
            <div>
                <label className="block font-medium">Title</label>
                <input type="text" {...register("Title", { required: true })} className="input" />
                {errors.Title && <p className="text-red-500 text-sm">Title is required</p>}
            </div>
            <div>
                <label className="block font-medium">Description</label>
                <textarea {...register("Description")} className="input" />
            </div>
            <button type="submit" className="btn-primary">Create Estimation</button>
        </form>
    );
}
