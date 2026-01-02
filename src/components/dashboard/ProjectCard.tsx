interface ProjectCardProps {
  project: {
    name: string;
    spent: number;
    leads: number;
    cplReal: number;
    status: string;
  };
}

const ProjectCard = ({ project }: ProjectCardProps) => {
  return (
    <div className="bg-[#1e293b]/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <h4 className="font-bold text-base text-slate-200 line-clamp-2">{project.name}</h4>
        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest border whitespace-nowrap ${
          project.status === 'OTIMIZADO' 
            ? 'bg-green-500/10 text-green-400 border-green-500/20' 
            : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
        }`}>
          {project.status}
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Investido</p>
          <p className="text-sm font-bold text-slate-300 font-mono">
            R$ {project.spent?.toLocaleString('pt-BR')}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Leads CRM</p>
          <p className="text-sm font-bold text-[#f90f54]">{project.leads}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">CPL Real</p>
          <p className="text-sm font-bold text-[#00C49F]">R$ {project.cplReal?.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
